import { PutObject, DeleteObject, Event } from './proto';

// eventually this will be the same as the IntentCode type, but for now we'll use a simpler type
type supportedIntentCodes = 'xfer-full';

/**
 * FDv2ChangeSetBuilder is a helper for constructing a change set for FDv2.
 * The main use case for this builder is to help construct a change set from
 * a FDv1 payload.
 *
 * @experimental
 * This type is not stable, and not subject to any backwards
 * compatibility guarantees or semantic versioning. It is not suitable for production usage.
 */
export default class FDv2ChangeSetBuilder {
  private intent?: supportedIntentCodes;
  private events: Event[] = [];

  /**
   * Begins a new change set with a given intent.
   */
  start(intent: supportedIntentCodes): this {
    this.intent = intent;
    this.events = [];

    return this;
  }

  /**
   * Returns the completed changeset.
   * NOTE: currently, this builder is not designed to continuously build changesets, rather
   * it is designed to construct a single changeset at a time. We can easily expand this by
   * resetting some values in the future.
   */
  finish(): Array<Event> {
    if (this.intent === undefined) {
      throw new Error('changeset: cannot complete without a server-intent');
    }

    // NOTE: currently the only use case for this builder is to
    // construct a change set for a file data intializer which only supports
    // FDv1 format. As such, we need to use dummy values to satisfy the FDv2
    // protocol.
    const events: Array<Event> = [
      {
        event: 'server-intent',
        data: {
          payloads: [{
              id: 'dummy-id',
              target: 1,
              intentCode: this.intent,
              reason: 'payload-missing',
            },
          ]
        }
      },
      ...this.events,
      {
        event: 'payload-transferred',
        data: {
          // IMPORTANT: the selector MUST be empty or "live" data synchronizers
          // will not work as it would try to resume from a bogus state.
          state: '',
          version: 1,
          id: 'dummy-id',
        }
      },
    ];

    return events;
  }

  /**
   * Adds a new object to the changeset.
   */
  putObject(obj: PutObject): this {
    this.events.push({
      event: 'put-object',
      data: obj,
    });

    return this
  }

  /**
   * Adds a deletion to the changeset.
   */
  deleteObject(obj: DeleteObject): this {
    this.events.push({
      event: 'delete-object',
      data: obj
    });

    return this
  }
}
