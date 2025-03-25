import { LDEvaluationReason, LDLogger } from '../../api';
import { LDDeliveryStatus, LDEventType } from '../../api/subsystem';
import LDContextDeduplicator from '../../api/subsystem/LDContextDeduplicator';
import LDEventProcessor from '../../api/subsystem/LDEventProcessor';
import AttributeReference from '../../AttributeReference';
import ContextFilter from '../../ContextFilter';
import { ClientContext } from '../../options';
import { LDHeaders } from '../../utils';
import { DiagnosticsManager } from '../diagnostics';
import EventSender from './EventSender';
import EventSummarizer, { SummarizedFlagsEvent } from './EventSummarizer';
import { isFeature, isIdentify, isMigration } from './guards';
import InputEvent from './InputEvent';
import InputIdentifyEvent from './InputIdentifyEvent';
import InputMigrationEvent from './InputMigrationEvent';
import LDInvalidSDKKeyError from './LDInvalidSDKKeyError';
import shouldSample from './sampling';

type FilteredContext = any;

/**
 * Used for both identify and index.
 */
interface IdentifyOutputEvent {
  kind: 'identify' | 'index';
  creationDate: number;
  context: FilteredContext;
  samplingRatio?: number;
}

interface CustomOutputEvent {
  kind: 'custom';
  creationDate: number;
  key: string;
  context: FilteredContext;
  data?: any;
  metricValue?: number;
  samplingRatio?: number;
  url?: string;
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
  samplingRatio?: number;
}

interface IndexInputEvent extends Omit<InputIdentifyEvent, 'kind'> {
  kind: 'index';
}

interface ClickOutputEvent {
  kind: 'click';
  key: string;
  url: string;
  creationDate: number;
  contextKeys: Record<string, string>;
  selector: string;
  samplingRatio?: number;
}

interface PageviewOutputEvent {
  kind: 'pageview';
  key: string;
  url: string;
  creationDate: number;
  contextKeys: Record<string, string>;
  samplingRatio?: number;
}

/**
 * The event processor doesn't need to know anything about the shape of the
 * diagnostic events.
 */
type DiagnosticEvent = any;

interface MigrationOutputEvent extends Omit<InputMigrationEvent, 'samplingRatio' | 'context'> {
  // Make the sampling ratio optional so we can omit it when it is one.
  samplingRatio?: number;
  context?: FilteredContext;
}

type OutputEvent =
  | IdentifyOutputEvent
  | CustomOutputEvent
  | FeatureOutputEvent
  | SummarizedFlagsEvent
  | DiagnosticEvent
  | MigrationOutputEvent;

export interface EventProcessorOptions {
  allAttributesPrivate: boolean;
  privateAttributes: string[];
  eventsCapacity: number;
  flushInterval: number;
  diagnosticRecordingInterval: number;
}

export default class EventProcessor implements LDEventProcessor {
  private _eventSender: EventSender;
  private _summarizer = new EventSummarizer();
  private _queue: OutputEvent[] = [];
  private _lastKnownPastTime = 0;
  private _droppedEvents = 0;
  private _deduplicatedUsers = 0;
  private _exceededCapacity = false;
  private _eventsInLastBatch = 0;
  private _shutdown = false;
  private _capacity: number;
  private _logger?: LDLogger;
  private _contextFilter: ContextFilter;

  // Using any here, because setInterval handles are not the same
  // between node and web.
  private _diagnosticsTimer: any;
  private _flushTimer: any;
  private _flushUsersTimer: any = null;

  constructor(
    private readonly _config: EventProcessorOptions,
    clientContext: ClientContext,
    baseHeaders: LDHeaders,
    private readonly _contextDeduplicator?: LDContextDeduplicator,
    private readonly _diagnosticsManager?: DiagnosticsManager,
    start: boolean = true,
  ) {
    this._capacity = _config.eventsCapacity;
    this._logger = clientContext.basicConfiguration.logger;
    this._eventSender = new EventSender(clientContext, baseHeaders);

    this._contextFilter = new ContextFilter(
      _config.allAttributesPrivate,
      _config.privateAttributes.map((ref) => new AttributeReference(ref)),
    );

    if (start) {
      this.start();
    }
  }

  start() {
    if (this._contextDeduplicator?.flushInterval !== undefined) {
      this._flushUsersTimer = setInterval(() => {
        this._contextDeduplicator?.flush();
      }, this._contextDeduplicator.flushInterval * 1000);
    }

    this._flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (e) {
        // Log errors and swallow them
        this._logger?.debug(`Flush failed: ${e}`);
      }
    }, this._config.flushInterval * 1000);

    if (this._diagnosticsManager) {
      const initEvent = this._diagnosticsManager!.createInitEvent();
      this._postDiagnosticEvent(initEvent);

      this._diagnosticsTimer = setInterval(() => {
        const statsEvent = this._diagnosticsManager!.createStatsEventAndReset(
          this._droppedEvents,
          this._deduplicatedUsers,
          this._eventsInLastBatch,
        );

        this._droppedEvents = 0;
        this._deduplicatedUsers = 0;

        this._postDiagnosticEvent(statsEvent);
      }, this._config.diagnosticRecordingInterval * 1000);
    }

    this._logger?.debug('Started EventProcessor.');
  }

  private _postDiagnosticEvent(event: DiagnosticEvent) {
    this._eventSender.sendEventData(LDEventType.DiagnosticEvent, event);
  }

  close() {
    clearInterval(this._flushTimer);
    if (this._flushUsersTimer) {
      clearInterval(this._flushUsersTimer);
    }
    if (this._diagnosticsTimer) {
      clearInterval(this._diagnosticsTimer);
    }
  }

  async flush(): Promise<void> {
    if (this._shutdown) {
      throw new LDInvalidSDKKeyError(
        'Events cannot be posted because a permanent error has been encountered. ' +
          'This is most likely an invalid SDK key. The specific error information ' +
          'is logged independently.',
      );
    }

    const eventsToFlush = this._queue;
    this._queue = [];
    const summary = this._summarizer.getSummary();
    this._summarizer.clearSummary();

    if (Object.keys(summary.features).length) {
      eventsToFlush.push(summary);
    }

    if (!eventsToFlush.length) {
      return;
    }

    this._eventsInLastBatch = eventsToFlush.length;
    this._logger?.debug('Flushing %d events', eventsToFlush.length);
    await this._tryPostingEvents(eventsToFlush);
  }

  sendEvent(inputEvent: InputEvent) {
    if (this._shutdown) {
      return;
    }

    if (isMigration(inputEvent)) {
      // These conditions are not combined, because we always want to stop
      // processing at this point for a migration event. It cannot generate
      // an index event or debug event.
      if (shouldSample(inputEvent.samplingRatio)) {
        const migrationEvent: MigrationOutputEvent = {
          ...inputEvent,
          context: inputEvent.context ? this._contextFilter.filter(inputEvent.context) : undefined,
        };
        if (migrationEvent.samplingRatio === 1) {
          delete migrationEvent.samplingRatio;
        }
        this._enqueue(migrationEvent);
      }
      return;
    }

    this._summarizer.summarizeEvent(inputEvent);

    const isFeatureEvent = isFeature(inputEvent);

    const addFullEvent = (isFeatureEvent && inputEvent.trackEvents) || !isFeatureEvent;

    const addDebugEvent = this._shouldDebugEvent(inputEvent);

    const isIdentifyEvent = isIdentify(inputEvent);
    const shouldNotDeduplicate = this._contextDeduplicator?.processContext(inputEvent.context);

    // If there is no cache, then it will never be in the cache.
    if (!shouldNotDeduplicate) {
      if (!isIdentifyEvent) {
        this._deduplicatedUsers += 1;
      }
    }

    const addIndexEvent = shouldNotDeduplicate && !isIdentifyEvent;

    if (addIndexEvent) {
      this._enqueue(
        this._makeOutputEvent(
          {
            kind: 'index',
            creationDate: inputEvent.creationDate,
            context: inputEvent.context,
            samplingRatio: 1,
          },
          false,
        ),
      );
    }
    if (addFullEvent && shouldSample(inputEvent.samplingRatio)) {
      this._enqueue(this._makeOutputEvent(inputEvent, false));
    }
    if (addDebugEvent && shouldSample(inputEvent.samplingRatio)) {
      this._enqueue(this._makeOutputEvent(inputEvent, true));
    }
  }

  private _makeOutputEvent(event: InputEvent | IndexInputEvent, debug: boolean): OutputEvent {
    switch (event.kind) {
      case 'feature': {
        const out: FeatureOutputEvent = {
          kind: debug ? 'debug' : 'feature',
          creationDate: event.creationDate,
          context: this._contextFilter.filter(event.context, !debug),
          key: event.key,
          value: event.value,
          default: event.default,
        };
        if (event.samplingRatio !== 1) {
          out.samplingRatio = event.samplingRatio;
        }
        if (event.prereqOf) {
          out.prereqOf = event.prereqOf;
        }
        if (event.variation !== undefined) {
          out.variation = event.variation;
        }
        if (event.version !== undefined) {
          out.version = event.version;
        }
        if (event.reason) {
          out.reason = event.reason;
        }
        return out;
      }
      case 'index': // Intentional fallthrough.
      case 'identify': {
        const out: IdentifyOutputEvent = {
          kind: event.kind,
          creationDate: event.creationDate,
          context: this._contextFilter.filter(event.context),
        };
        if (event.samplingRatio !== 1) {
          out.samplingRatio = event.samplingRatio;
        }
        return out;
      }
      case 'custom': {
        const out: CustomOutputEvent = {
          kind: 'custom',
          creationDate: event.creationDate,
          key: event.key,
          context: this._contextFilter.filter(event.context),
        };

        if (event.samplingRatio !== 1) {
          out.samplingRatio = event.samplingRatio;
        }

        if (event.data !== undefined) {
          out.data = event.data;
        }
        if (event.metricValue !== undefined) {
          out.metricValue = event.metricValue;
        }

        if (event.url !== undefined) {
          out.url = event.url;
        }

        return out;
      }
      case 'click': {
        const out: ClickOutputEvent = {
          kind: 'click',
          creationDate: event.creationDate,
          contextKeys: event.context.kindsAndKeys,
          key: event.key,
          url: event.url,
          selector: event.selector,
        };
        return out;
      }
      case 'pageview': {
        const out: PageviewOutputEvent = {
          kind: 'pageview',
          creationDate: event.creationDate,
          contextKeys: event.context.kindsAndKeys,
          key: event.key,
          url: event.url,
        };
        return out;
      }
      default:
        // This would happen during the addition of a new event type to the SDK.
        return event;
    }
  }

  private _enqueue(event: OutputEvent) {
    if (this._queue.length < this._capacity) {
      this._queue.push(event);
      this._exceededCapacity = false;
    } else {
      if (!this._exceededCapacity) {
        this._exceededCapacity = true;
        this._logger?.warn(
          'Exceeded event queue capacity. Increase capacity to avoid dropping events.',
        );
      }
      this._droppedEvents += 1;
    }
  }

  private _shouldDebugEvent(event: InputEvent) {
    return (
      isFeature(event) &&
      event.debugEventsUntilDate &&
      event.debugEventsUntilDate > this._lastKnownPastTime &&
      event.debugEventsUntilDate > Date.now()
    );
  }

  private async _tryPostingEvents(events: OutputEvent[] | OutputEvent): Promise<void> {
    const res = await this._eventSender.sendEventData(LDEventType.AnalyticsEvents, events);
    if (res.status === LDDeliveryStatus.FailedAndMustShutDown) {
      this._shutdown = true;
    }

    if (res.serverTime) {
      this._lastKnownPastTime = res.serverTime;
    }

    if (res.error) {
      throw res.error;
    }
  }
}
