import { PayloadProcessor } from './payloadProcessor';
import { DeleteObject, Event, PutObject, EventType } from './proto';

// eventually this will be the same as the IntentCode type, but for now we'll use a simpler type
type supportedIntentCodes = 'xfer-full';

interface fdv1Payload {
  flags: { [name: string]: any };
  segments: { [name: string]: any };
}

const PAYLOAD_ID = 'FDv1Fallback';

/**
 * FDv1PayloadAdaptor is a helper for constructing a change set for FDv2.
 * The main use case for this adaptor is to help construct a change set from
 * a FDv1 payload.
 *
 * @experimental
 * This type is not stable, and not subject to any backwards
 * compatibility guarantees or semantic versioning. It is not suitable for production usage.
 */
export default class FDv1PayloadAdaptor {
  private _events: Event[] = [];
  private _processor: PayloadProcessor;
  private _selector: string = '';
  private _intent: supportedIntentCodes = 'xfer-full';

  constructor(processor: PayloadProcessor) {
    this._processor = processor
  }

  /**
   * Begins a new change set with a given intent.
   */
  start(intent: supportedIntentCodes): this {
    if (intent !== 'xfer-full') {
      throw new Error('intent: only xfer-full is supported');
    }

    this._events = []
    this._intent = intent;

    return this;
  }

  /**
   * Customizes the selector to use for the change set.
   *
   * NOTE: you probably only need this method for a synchronizer
   * fallback scenario.
   *
   * @param selector - the selector to use for the change set
   * @returns {this} - the adaptor instance
   */
  useSelector(selector: string): this {
    this._selector = selector;
    return this;
  }

  /**
   * Returns the completed changeset.
   * NOTE: currently, this adaptor is not designed to continuously build changesets, rather
   * it is designed to construct a single changeset at a time. We can easily expand this by
   * resetting some values in the future.
   */
  finish(): this {
    // NOTE: currently the only use case for this adaptor is to
    // construct a change set for a file data intializer which only supports
    // FDv1 format. As such, we need to use dummy values to satisfy the FDv2
    // protocol.
    const serverIntentEvent: Event = {
      event: 'server-intent',
      data: {
        payloads: [{
          id: PAYLOAD_ID,
          target: 1,
          intentCode: this._intent,
          reason: 'payload-missing'
        }],
      },
    };

    const finishEvent: Event = {
      event: 'payload-transferred',
      data: {
        // IMPORTANT: the selector MUST be empty or "live" data synchronizers
        // will not work as it would try to resume from a bogus state.
        state: this._selector,
        version: 1,
        id: PAYLOAD_ID,
      },
    };

    this._processor.processEvents([
      serverIntentEvent,
      ...this._events,
      finishEvent,
    ]);
    this._events = []

    return this;
  }

  /**
   * 
   * @param data - FDv1 payload from a fdv1 poll
   */
  pushFdv1Payload(data: fdv1Payload): this {
    Object.entries(data?.flags || []).forEach(([key, flag]) => {
      this.putObject({
          // strong assumption here that we only have segments and flags.
          kind: 'flag',
          key: key,
          version: flag.version || 1,
          object: flag,
        });
    });

    Object.entries(data?.segments || []).forEach(([key, segment]) => {
      this.putObject({
          // strong assumption here that we only have segments and flags.
          kind: 'segment',
          key: key,
          version: segment.version || 1,
          object: segment,
        });
    });

    return this
  }

  /**
   * Adds a new object to the changeset.
   */
  putObject(obj: PutObject): this {
    this._events.push({
      event: 'put-object',
      data: obj,
    });

    return this;
  }

  /**
   * Adds a deletion to the changeset.
   */
  deleteObject(obj: DeleteObject): this {
    this._events.push({
      event: 'delete-object',
      data: obj,
    });

    return this;
  }
}
