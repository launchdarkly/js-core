import { LDEvaluationReason } from '../../api/data/LDEvaluationReason';
import { LDLogger } from '../../api/logging/LDLogger';
import LDContextDeduplicator from '../../api/subsystem/LDContextDeduplicator';
import LDEventProcessor from '../../api/subsystem/LDEventProcessor';
import LDEventSender, { LDDeliveryStatus, LDEventType } from '../../api/subsystem/LDEventSender';
import AttributeReference from '../../AttributeReference';
import ContextFilter from '../../ContextFilter';
import shouldSample from '../../internal/events/sampling';
import ClientContext from '../../options/ClientContext';
import EventSummarizer, { SummarizedFlagsEvent } from './EventSummarizer';
import { isFeature, isIdentify, isMigration } from './guards';
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
  samplingRatio: number;
}

interface CustomOutputEvent {
  kind: 'custom';
  creationDate: number;
  key: string;
  contextKeys: Record<string, string>;
  data?: any;
  metricValue?: number;
  samplingRatio: number;
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
  samplingRatio: number;
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
    private readonly eventSender: LDEventSender,
    private readonly contextDeduplicator: LDContextDeduplicator,
    private readonly diagnosticsManager?: LDDiagnosticsManager,
  ) {
    this.capacity = config.eventsCapacity;
    this.logger = clientContext.basicConfiguration.logger;

    this.contextFilter = new ContextFilter(
      config.allAttributesPrivate,
      config.privateAttributes.map((ref) => new AttributeReference(ref)),
    );

    if (this.contextDeduplicator.flushInterval !== undefined) {
      this.flushUsersTimer = setInterval(() => {
        this.contextDeduplicator.flush();
      }, this.contextDeduplicator.flushInterval * 1000);
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

    if (isMigration(inputEvent)) {
      // These conditions are not combined, because we always want to stop
      // processing at this point for a migration event. It cannot generate
      // an index event or debug event.
      if (shouldSample(inputEvent.samplingRatio)) {
        this.enqueue({
          ...inputEvent,
        });
      }
      return;
    }

    this.summarizer.summarizeEvent(inputEvent);

    const isFeatureEvent = isFeature(inputEvent);
    const featureSamplingRatio = isFeatureEvent ? inputEvent.samplingRatio : 1;
    // Combine the sampling of feature and debug events. Only use RNG when this is actually a
    // feature event.
    const wouldSampleFeature = isFeatureEvent ? shouldSample(featureSamplingRatio) : true;

    const addFullEvent =
      (isFeatureEvent && inputEvent.trackEvents && wouldSampleFeature) ||
      (!isFeatureEvent && shouldSample(inputEvent.samplingRatio));
    const addDebugEvent = wouldSampleFeature && this.shouldDebugEvent(inputEvent);

    const isIdentifyEvent = isIdentify(inputEvent);

    // We only want to notify the de-duplicator if we would sample the index event.
    // Otherwise we could deduplicate and then not send the event.
    const shouldNotDeduplicate = this.contextDeduplicator.processContext(inputEvent.context);

    // If there is no cache, then it will never be in the cache.
    if (!shouldNotDeduplicate) {
      if (!isIdentifyEvent) {
        this.deduplicatedUsers += 1;
      }
    }

    const addIndexEvent = shouldNotDeduplicate && !isIdentifyEvent;

    if (addIndexEvent && shouldSample(inputEvent.indexSamplingRatio)) {
      this.enqueue({
        kind: 'index',
        creationDate: inputEvent.creationDate,
        context: this.contextFilter.filter(inputEvent.context),
        samplingRatio: inputEvent.indexSamplingRatio,
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
          samplingRatio: event.samplingRatio,
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
          samplingRatio: event.samplingRatio,
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
