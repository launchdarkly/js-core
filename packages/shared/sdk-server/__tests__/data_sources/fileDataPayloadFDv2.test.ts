import { makeFullPayloadSender } from '../../src/data_sources/fileDataPayloadFDv2';

it('sends the merged items as one full payload without a selector', () => {
  const flag = {
    key: 'flag-key',
    on: true,
    fallthrough: { variation: 0 },
    variations: [true],
    version: 3,
  };
  const segment = { key: 'segment-key', included: ['user-key'], version: 2 };
  const onPayload = jest.fn();
  const onError = jest.fn();
  const send = makeFullPayloadSender(onPayload, onError);

  // Send one merge result.
  send({
    flags: [{ key: 'flag-key', item: flag }],
    segments: [{ key: 'segment-key', item: segment }],
    documents: [],
  });

  // One full payload has an empty selector and an update for each item.
  expect(onPayload).toHaveBeenCalledTimes(1);
  const payload = onPayload.mock.calls[0][0];
  expect(payload.type).toEqual('full');
  expect(payload.state).toEqual('');
  expect(payload.updates).toEqual([
    expect.objectContaining({ kind: 'flag', key: 'flag-key', version: 3, object: flag }),
    expect.objectContaining({ kind: 'segment', key: 'segment-key', version: 2, object: segment }),
  ]);
  expect(onError).not.toHaveBeenCalled();
});
