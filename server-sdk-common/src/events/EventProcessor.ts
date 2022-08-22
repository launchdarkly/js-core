import {
  AttributeReference, ContextFilter, LDLogger, ApplicationTags, LDEvaluationReason,
  ClientContext, Requests,
} from '@launchdarkly/js-sdk-common';
import { nanoid } from 'nanoid';
import LruCache from '../cache/LruCache';
import defaultHeaders from '../data_sources/defaultHeaders';
import httpErrorMessage from '../data_sources/httpErrorMessage';
import { isHttpRecoverable, LDInvalidSDKKeyError, LDUnexpectedResponseError } from '../errors';
import EventSummarizer, { SummarizedFlagsEvent } from './EventSummarizer';
import { isFeature, isIdentify } from './guards';
import InputEvent from './InputEvent';
import LDEventProcessor from './LDEventProcessor';

type FilteredContext = any;

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

/**
 * The event processor doesn't need to know anything about the shape of the
 * diagnostic events.
 */
type DiagnosticEvent = any;

type OutputEvent = IdentifyOutputEvent
| CustomOutputEvent
| FeatureOutputEvent
| SummarizedFlagsEvent
| DiagnosticEvent;

export interface EventProcessorOptions {
  allAttributesPrivate: boolean;
  privateAttributes: string[];
  eventsCapacity: number;
  tags: ApplicationTags;
  flushInterval: number;
  diagnosticRecordingInterval: number;
  /* Only used in server SDKs. */
  contextKeysFlushInterval?: number;
  /* Only used in server SDKs. */
  contextKeysCapacity?: number;
}

interface LDDiagnosticsManager {
  createInitEvent(): DiagnosticEvent;
  createStatsEventAndReset(
    droppedEvents: number,
    deduplicatedUsers: number,
    eventsInLastBatch: number,
  ): DiagnosticEvent;
}

/**
 * @internal
 */
export default class EventProcessor implements LDEventProcessor {
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

  private contextFilter: ContextFilter;

  /**
   * Will be created if contextKeysFlushInterval and contextKeysCapacity are
   * set.
   */
  private contextKeysCache?: LruCache;

  private eventsUri: string;

  private diagnosticEventsUri: string;

  // Using any here, because setInterval handles are not the same
  // between node and web.
  private diagnosticsTimer: any;

  private flushTimer: any;

  private flushUsersTimer: any = null;

  private defaultHeaders: {
    [key: string]: string;
  };

  private requests: Requests;

  constructor(
    config: EventProcessorOptions,
    clientContext: ClientContext,
    private readonly diagnosticsManager?: LDDiagnosticsManager,
  ) {
    this.capacity = config.eventsCapacity;
    this.logger = clientContext.basicConfiguration.logger;
    if (config.contextKeysCapacity !== undefined && config.contextKeysFlushInterval !== undefined) {
      this.contextKeysCache = new LruCache({ max: config.contextKeysCapacity });
    }
    this.contextFilter = new ContextFilter(
      config.allAttributesPrivate,
      config.privateAttributes.map((ref) => new AttributeReference(ref)),
    );

    this.defaultHeaders = {
      ...defaultHeaders(
        clientContext.basicConfiguration.sdkKey,
        config,
        clientContext.platform.info,
      ),
    };

    this.requests = clientContext.platform.requests;

    this.eventsUri = `${clientContext.basicConfiguration.serviceEndpoints.events}/bulk`;

    this.diagnosticEventsUri = `${clientContext.basicConfiguration.serviceEndpoints.events}/diagnostic`;

    if (this.contextKeysCache) {
      this.flushUsersTimer = setInterval(() => {
        this.contextKeysCache!.clear();
      }, config.contextKeysFlushInterval! * 1000);
    }

    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch {
        // Eat the errors.
      }
    }, config.flushInterval * 1000);

    if (this.diagnosticsManager) {
      const initEvent = diagnosticsManager!.createInitEvent();
      this.postDiagnosticEvent(initEvent);

      this.diagnosticsTimer = setInterval(() => {
        const statsEvent = this.diagnosticsManager!.createStatsEventAndReset(
          this.droppedEvents,
          this.deduplicatedUsers,
          this.eventsInLastBatch,
        );

        this.droppedEvents = 0;
        this.deduplicatedUsers = 0;

        this.postDiagnosticEvent(statsEvent);
      }, config.diagnosticRecordingInterval * 1000);
    }
  }

  private postDiagnosticEvent(event: DiagnosticEvent) {
    this.tryPostingEvents(event, this.diagnosticEventsUri, undefined, true).catch(() => { });
  }

  close() {
    clearInterval(this.flushTimer);
    if (this.flushUsersTimer) {
      clearInterval(this.flushUsersTimer);
    }
    if (this.diagnosticsTimer) {
      clearInterval(this.diagnosticsTimer);
    }
  }

  async flush(): Promise<void> {
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
      return;
    }

    this.eventsInLastBatch = eventsToFlush.length;
    this.logger?.debug('Flushing %d events', eventsToFlush.length);
    await this.tryPostingEvents(eventsToFlush, this.eventsUri, nanoid(), true);
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
    const inCache = this.contextKeysCache?.get(inputEvent.context.canonicalKey);

    // If there is no cache, then it will never be in the cache.
    if (inCache) {
      if (!isIdentifyEvent) {
        this.deduplicatedUsers += 1;
      }
    }

    this.contextKeysCache?.set(inputEvent.context.canonicalKey, true);

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

  private shouldDebugEvent(event: InputEvent) {
    return isFeature(event)
      && event.debugEventsUntilDate
      && (event.debugEventsUntilDate > this.lastKnownPastTime)
      && (event.debugEventsUntilDate > Date.now());
  }

  private async tryPostingEvents(
    events: OutputEvent[] | OutputEvent,
    uri: string,
    payloadId: string | undefined,
    canRetry: boolean,
  ): Promise<void> {
    const headers = {
      ...this.defaultHeaders,
    };

    if (payloadId) {
      headers['x-launchdarkly-payload-id'] = payloadId;
      headers['x-launchDarkly-event-schema'] = '4';
    }
    let error;
    try {
      const res = await this.requests.fetch(uri, {
        headers,
        body: JSON.stringify(events),
        method: 'POST',
      });

      const serverDate = Date.parse(res.headers.get('date') || '');
      if (serverDate) {
        this.lastKnownPastTime = serverDate;
      }

      if (res.status <= 204) {
        return;
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
    await this.tryPostingEvents(events, this.eventsUri, payloadId, false);
  }
}
