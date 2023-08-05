import { LDEvaluationReason, LDLogger } from '../../api';
import { LDDeliveryStatus, LDEventType } from '../../api/subsystem';
import LDContextDeduplicator from '../../api/subsystem/LDContextDeduplicator';
import LDEventProcessor from '../../api/subsystem/LDEventProcessor';
import AttributeReference from '../../AttributeReference';
import ContextFilter from '../../ContextFilter';
import { ClientContext } from '../../options';
import EventSender from './EventSender';
import EventSummarizer, { SummarizedFlagsEvent } from './EventSummarizer';
import { isFeature, isIdentify } from './guards';
import InputEvent from './InputEvent';
import LDInvalidSDKKeyError from './LDInvalidSDKKeyError';

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
  data?: any;
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

type OutputEvent =
  | IdentifyOutputEvent
  | CustomOutputEvent
  | FeatureOutputEvent
  | SummarizedFlagsEvent
  | DiagnosticEvent;

export interface EventProcessorOptions {
  allAttributesPrivate: boolean;
  privateAttributes: string[];
  eventsCapacity: number;
  flushInterval: number;
  diagnosticRecordingInterval: number;
}

interface LDDiagnosticsManager {
  createInitEvent(): DiagnosticEvent;
  createStatsEventAndReset(
    droppedEvents: number,
    deduplicatedUsers: number,
    eventsInLastBatch: number,
  ): DiagnosticEvent;
}

export default class EventProcessor implements LDEventProcessor {
  private eventSender: EventSender;
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

  // Using any here, because setInterval handles are not the same
  // between node and web.
  private diagnosticsTimer: any;
  private flushTimer: any;
  private flushUsersTimer: any = null;

  constructor(
    config: EventProcessorOptions,
    clientContext: ClientContext,
    private readonly contextDeduplicator?: LDContextDeduplicator,
    private readonly diagnosticsManager?: LDDiagnosticsManager,
  ) {
    this.capacity = config.eventsCapacity;
    this.logger = clientContext.basicConfiguration.logger;
    this.eventSender = new EventSender(clientContext);

    this.contextFilter = new ContextFilter(
      config.allAttributesPrivate,
      config.privateAttributes.map((ref) => new AttributeReference(ref)),
    );

    if (this.contextDeduplicator?.flushInterval !== undefined) {
      this.flushUsersTimer = setInterval(() => {
        this.contextDeduplicator?.flush();
      }, this.contextDeduplicator.flushInterval * 1000);
    }

    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (e) {
        // Log errors and swallow them
        this.logger?.debug(`Flush failed: ${e}`);
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
    this.eventSender.sendEventData(LDEventType.DiagnosticEvent, event);
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
    await this.tryPostingEvents(eventsToFlush);
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
    const shouldNotDeduplicate = this.contextDeduplicator?.processContext(inputEvent.context);

    // If there is no cache, then it will never be in the cache.
    if (!shouldNotDeduplicate) {
      if (!isIdentifyEvent) {
        this.deduplicatedUsers += 1;
      }
    }

    const addIndexEvent = shouldNotDeduplicate && !isIdentifyEvent;

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
        // This would happen during the addition of a new event type to the SDK.
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
        this.logger?.warn(
          'Exceeded event queue capacity. Increase capacity to avoid dropping events.',
        );
      }
      this.droppedEvents += 1;
    }
  }

  private shouldDebugEvent(event: InputEvent) {
    return (
      isFeature(event) &&
      event.debugEventsUntilDate &&
      event.debugEventsUntilDate > this.lastKnownPastTime &&
      event.debugEventsUntilDate > Date.now()
    );
  }

  private async tryPostingEvents(events: OutputEvent[] | OutputEvent): Promise<void> {
    const res = await this.eventSender.sendEventData(LDEventType.AnalyticsEvents, events);
    if (res.status === LDDeliveryStatus.FailedAndMustShutDown) {
      this.shutdown = true;
    }

    if (res.serverTime) {
      this.lastKnownPastTime = res.serverTime;
    }

    if (res.error) {
      throw res.error;
    }
  }
}
