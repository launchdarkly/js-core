import {
  AttributeReference, ContextFilter, LDLogger,
} from '@launchdarkly/js-sdk-common';
import { v4 as uuidv4 } from 'uuid';
import { LDEvaluationReason } from '../api';
import LruCache from '../cache/LruCache';
import defaultHeaders from '../data_sources/defaultHeaders';
import httpErrorMessage from '../data_sources/httpErrorMessage';
import { isHttpRecoverable, LDInvalidSDKKeyError, LDUnexpectedResponseError } from '../errors';
import Configuration from '../options/Configuration';
import { Info, Requests } from '../platform';
import EventSummarizer, { SummarizedFlagsEvent } from './EventSummarizer';
import { isFeature, isIdentify } from './guards';
import InputEvent from './InputEvent';

interface FilteredContext {

}

/**
 * Used for both identify and index.
 */
interface IdentifyOutputEvent {
  kind: 'identify' | 'index';
  creationDate: number;
  context: FilteredContext;
}

interface CustomOutputEvent {
  kind: 'custom';
  creationDate: number;
  key: string;
  contextKeys: Record<string, string>;
  data?: any
  metricValue?: number;
}

interface FeatureOutputEvent {
  kind: 'feature' | 'debug';
  creationDate: number;
  key: string;
  value: any;
  default: any;
  prereqOf?: string;
  variation?: number;
  version?: number;
  reason?: LDEvaluationReason;
  context?: FilteredContext;
  contextKeys?: Record<string, string>;
}

type OutputEvent = IdentifyOutputEvent
| CustomOutputEvent
| FeatureOutputEvent
| SummarizedFlagsEvent;

export default class EventProcessor {
  private summarizer = new EventSummarizer();

  private queue: OutputEvent[] = [];

  private lastKnownPastTime = 0;

  private droppedEvents = 0;

  private deduplicatedUsers = 0;

  private exceededCapacity = false;

  private eventsInLastBatch = 0;

  private shutdown = false;

  private capacity: number;

  private logger?: LDLogger;

  private contextKeysCache: LruCache;

  private contextFilter: ContextFilter;

  private uri: string;

  // Using any here, because setInterval handles are not the same
  // between node and web.
  private diagnosticsTimer: any;

  private flushTimer: any;

  private flushUsersTimer: any;

  private defaultHeaders: {
    [key: string]: string | string[];
  };

  constructor(sdkKey: string, config: Configuration, info: Info, private requests: Requests) {
    this.capacity = config.eventsCapacity;
    this.logger = config.logger;
    this.contextKeysCache = new LruCache({ max: config.contextKeysCapacity });
    this.contextFilter = new ContextFilter(
      config.allAttributesPrivate,
      config.privateAttributes.map((ref) => new AttributeReference(ref)),
    );
    this.defaultHeaders = {
      ...defaultHeaders(sdkKey, config, info),
      'x-launchDarkly-event-schema': '3',
    };
    this.uri = `${config.serviceEndpoints.events}/bulk`;

    this.flushUsersTimer = setInterval(() => {
      this.contextKeysCache.clear();
    }, config.contextKeysFlushInterval * 1000);

    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch {
        // Eat the errors.
      }
    }, config.flushInterval * 1000);

    // TODO: Implement diagnostics.
  }

  close() {
    clearInterval(this.flushTimer);
    clearInterval(this.flushUsersTimer);
    if (this.diagnosticsTimer) {
      clearInterval(this.diagnosticsTimer);
    }
  }

  async flush(): Promise<boolean> {
    if (this.shutdown) {
      throw new LDInvalidSDKKeyError('Events cannot be posted because SDK key is invalid');
    }

    const eventsToFlush = this.queue;
    this.queue = [];
    const summary = this.summarizer.getSummary();
    this.summarizer.clearSummary();

    if (Object.keys(summary.features).length) {
      eventsToFlush.push(summary);
    }

    if (!eventsToFlush.length) {
      return true;
    }

    this.eventsInLastBatch = eventsToFlush.length;
    this.logger?.debug('Flushing %d events', eventsToFlush.length);
    return this.tryPostingEvents(eventsToFlush, uuidv4(), true);
  }

  async tryPostingEvents(
    events: OutputEvent[],
    payloadId: string,
    canRetry: boolean,
  ): Promise<boolean> {
    const headers = {
      ...this.defaultHeaders,
      'x-launchdarkly-payload-id': payloadId,
    };

    let error;
    try {
      const res = await this.requests.fetch(this.uri, {
        headers,
        body: JSON.stringify(events),
        method: 'POST',
      });

      const serverDate = Date.parse(res.headers.get('date') || '');
      if (serverDate) {
        this.lastKnownPastTime = serverDate;
      }

      if (res.status <= 204) {
        return true;
      }

      error = new LDUnexpectedResponseError(
        httpErrorMessage(
          { status: res.status, message: 'some events were dropped' },
          'event posting',
        ),
      );

      if (!isHttpRecoverable(res.status)) {
        this.shutdown = true;
        throw error;
      }
    } catch (err) {
      error = err;
    }

    if (this.shutdown || (error && !canRetry)) {
      throw error;
    }

    await new Promise((r) => { setTimeout(r, 1000); });
    return this.tryPostingEvents(events, payloadId, false);
  }

  sendEvent(inputEvent: InputEvent) {
    if (this.shutdown) {
      return;
    }

    this.summarizer.summarizeEvent(inputEvent);

    const isFeatureEvent = isFeature(inputEvent);
    const addFullEvent = (isFeatureEvent && inputEvent.trackEvents) || !isFeatureEvent;
    const addDebugEvent = this.shouldDebugEvent(inputEvent);

    const isIdentifyEvent = isIdentify(inputEvent);
    const inCache = this.contextKeysCache.get(inputEvent.context.canonicalKey);

    if (inCache) {
      if (!isIdentifyEvent) {
        this.deduplicatedUsers += 1;
      }
    }

    this.contextKeysCache.set(inputEvent.context.canonicalKey, true);

    const addIndexEvent = !inCache && !isIdentifyEvent;

    if (addIndexEvent) {
      this.enqueue({
        kind: 'index',
        creationDate: inputEvent.creationDate,
        context: this.contextFilter.filter(inputEvent.context),
      });
    }
    if (addFullEvent) {
      this.enqueue(this.makeOutputEvent(inputEvent, false));
    }
    if (addDebugEvent) {
      this.enqueue(this.makeOutputEvent(inputEvent, true));
    }
  }

  private makeOutputEvent(event: InputEvent, debug: boolean): OutputEvent {
    switch (event.kind) {
      case 'feature': {
        const out: FeatureOutputEvent = {
          kind: debug ? 'debug' : 'feature',
          creationDate: event.creationDate,
          key: event.key,
          value: event.value,
          default: event.default,
          prereqOf: event.prereqOf,
        };
        if (event.variation !== undefined) {
          out.variation = event.variation;
        }
        if (event.version !== undefined) {
          out.version = event.version;
        }
        if (event.reason) {
          out.reason = event.reason;
        }
        if (debug) {
          out.context = this.contextFilter.filter(event.context);
        } else {
          out.contextKeys = event.context.kindsAndKeys;
        }
        return out;
      }
      case 'identify': {
        return {
          kind: 'identify',
          creationDate: event.creationDate,
          context: this.contextFilter.filter(event.context),
        };
      }
      case 'custom': {
        const out: CustomOutputEvent = {
          kind: 'custom',
          creationDate: event.creationDate,
          key: event.key,
          contextKeys: event.context.kindsAndKeys,
        };

        if (event.data !== undefined) {
          out.data = event.data;
        }
        if (event.metricValue !== undefined) {
          out.metricValue = event.metricValue;
        }

        return out;
      }
      default:
        // TODO: This is what it did do, but I am not sure
        // about this.
        return event;
    }
  }

  private enqueue(event: OutputEvent) {
    if (this.queue.length < this.capacity) {
      this.queue.push(event);
      this.exceededCapacity = false;
    } else {
      if (!this.exceededCapacity) {
        this.exceededCapacity = true;
        this.logger?.warn('Exceeded event queue capacity. Increase capacity to avoid dropping events.');
      }
      this.droppedEvents += 1;
    }
  }

  shouldDebugEvent(event: InputEvent) {
    return isFeature(event)
      && event.debugEventsUntilDate
      && (event.debugEventsUntilDate > this.lastKnownPastTime)
      && (event.debugEventsUntilDate > Date.now());
  }
}
