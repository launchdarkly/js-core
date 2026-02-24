import { PayloadProcessor } from './payloadProcessor';
import { FDv2Event } from './proto';

interface fdv1Payload {
  flags: { [name: string]: any };
  segments: { [name: string]: any };
}

const PAYLOAD_ID = 'FDv1Fallback';

/**
 * The FDv1PayloadAdaptor is a helper class that converts FDv1 payloads into events that the PayloadProcessor can understand.
 */
export interface FDv1PayloadAdaptor {
  /**
   * The PayloadProcessor that will be used to process the events.
   */
  readonly _processor: PayloadProcessor;

  /**
   * The selector that will be used to identify the payload.
   */
  _selector: string;

  /**
   * The method that will be used to set a selector for the payload that is
   * being processed.
   *
   * @remarks
   * This method probably shouldn't be used in most instances as FDv1 payloads
   * do not have the concept of a selector.
   *
   * @param selector - The selector to set for the payload.
   * @returns this FDv1PayloadAdaptor instance
   */
  useSelector: (selector: string) => FDv1PayloadAdaptor;

  /**
   * The method that will be used to process a full transfer changeset.
   *
   * @param data - The data to process.
   */
  processFullTransfer: (data: fdv1Payload) => void;
}

export function fdv1PayloadAdaptor(processor: PayloadProcessor): FDv1PayloadAdaptor {
  return {
    _processor: processor,
    _selector: '',
    useSelector(selector: string): FDv1PayloadAdaptor {
      this._selector = selector;
      return this;
    },
    processFullTransfer(data) {
      const events: Array<FDv2Event> = [
        {
          event: 'server-intent',
          data: {
            payloads: [
              {
                id: PAYLOAD_ID,
                target: 1,
                intentCode: 'xfer-full',
                reason: 'payload-missing',
              },
            ],
          },
        },
      ];

      Object.entries(data?.flags || []).forEach(([key, flag]) => {
        events.push({
          event: 'put-object',
          data: {
            kind: 'flag',
            key,
            version: flag.version || 1,
            object: flag,
          },
        });
      });

      Object.entries(data?.segments || []).forEach(([key, segment]) => {
        events.push({
          event: 'put-object',
          data: {
            kind: 'segment',
            key,
            version: segment.version || 1,
            object: segment,
          },
        });
      });

      events.push({
        event: 'payload-transferred',
        data: {
          // IMPORTANT: the selector MUST be empty or "live" data synchronizers
          // will not work as it would try to resume from a bogus state.
          state: this._selector,
          version: 1,
          id: PAYLOAD_ID,
        },
      });

      this._processor.processEvents(events);
    },
  };
}
