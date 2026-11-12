import { DataSourceErrorKind, internal, LDLogger } from '@launchdarkly/js-sdk-common';

import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import { processFlag, processSegment } from '../store/serialization';
import { KeyedItem, MergeResult } from './filedata';

function byKey<T>(items: KeyedItem<T>[]): { [key: string]: T } {
  // A null-prototype object, so that an item key such as __proto__ is an ordinary key.
  const result: { [key: string]: T } = Object.create(null);
  items.forEach(({ key, item }) => {
    result[key] = item;
  });
  return result;
}

/**
 * Makes a function that sends the merged data of a file load as one full FDv2 payload. The
 * function gives the payload to `onPayload` before it returns. Each item is keyed by the key
 * that the merge gave it.
 *
 * The payload has an empty selector because file data does not come from LaunchDarkly. A later
 * streaming or polling synchronizer must not send it to LaunchDarkly as a basis.
 *
 * @param onPayload Receives each payload.
 * @param onError Receives an error that the payload processing finds in the data.
 * @param logger The logger of the payload processing.
 *
 * @internal
 */
export function makeFullPayloadSender(
  onPayload: (payload: internal.Payload) => void,
  onError: (errorKind: DataSourceErrorKind, message: string) => void,
  logger?: LDLogger,
): (result: MergeResult) => void {
  const payloadProcessor = new internal.PayloadProcessor(
    {
      flag: (flag: Flag) => {
        processFlag(flag);
        return flag;
      },
      segment: (segment: Segment) => {
        processSegment(segment);
        return segment;
      },
    },
    onError,
    logger,
  );
  payloadProcessor.addPayloadListener(onPayload);
  const adaptor = internal.FDv1PayloadAdaptor(payloadProcessor).useSelector('');
  return (result: MergeResult) => {
    adaptor.processFullTransfer({
      flags: byKey(result.flags),
      segments: byKey(result.segments),
    });
  };
}
