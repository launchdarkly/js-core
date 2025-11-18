import FDv2ChangeSetBuilder from '../../../src/internal/fdv2/FDv2ChangeSetBuilder';
import { DeleteObject, Event, PutObject } from '../../../src/internal/fdv2/proto';

it('throws an error when finishing without starting', () => {
  const builder = new FDv2ChangeSetBuilder();
  expect(() => builder.finish()).toThrow('changeset: cannot complete without a server-intent');
});

it('starts a new changeset with the given intent', () => {
  const builder = new FDv2ChangeSetBuilder();
  builder.start('xfer-full');
  const result = builder.finish();

  expect(result).toBeDefined();
  expect(result.length).toBeGreaterThan(0);
  expect(result[0].event).toBe('server-intent');
});

it('resets events when starting a new changeset', () => {
  const builder = new FDv2ChangeSetBuilder();
  builder.start('xfer-full');
  builder.putObject({ kind: 'flag', key: 'test-flag', version: 1, object: {} });
  builder.start('xfer-full');
  const result = builder.finish();

  // Should only have server-intent and payload-transferred, no put-object events
  const putObjectEvents = result.filter((e) => e.event === 'put-object');
  expect(putObjectEvents.length).toBe(0);
});

it('includes server-intent as the first event with correct structure', () => {
  const builder = new FDv2ChangeSetBuilder();
  builder.start('xfer-full');
  const result = builder.finish();

  const serverIntentEvent = result[0] as Event;
  expect(serverIntentEvent.event).toBe('server-intent');
  expect(serverIntentEvent.data).toBeDefined();

  const intentData = serverIntentEvent.data as any;
  expect(intentData.payloads).toBeDefined();
  expect(intentData.payloads.length).toBe(1);
  expect(intentData.payloads[0].intentCode).toBe('xfer-full');
  expect(intentData.payloads[0].id).toBe('dummy-id');
  expect(intentData.payloads[0].target).toBe(1);
  expect(intentData.payloads[0].reason).toBe('payload-missing');
});

it('includes payload-transferred as the last event with empty state', () => {
  const builder = new FDv2ChangeSetBuilder();
  builder.start('xfer-full');
  const result = builder.finish();

  const payloadTransferredEvent = result[result.length - 1] as Event;
  expect(payloadTransferredEvent.event).toBe('payload-transferred');
  expect(payloadTransferredEvent.data).toBeDefined();

  const transferredData = payloadTransferredEvent.data as any;
  expect(transferredData.state).toBe('');
  expect(transferredData.version).toBe(1);
  expect(transferredData.id).toBe('dummy-id');
});

it('includes all put and delete events between server-intent and payload-transferred', () => {
  const builder = new FDv2ChangeSetBuilder();
  const putObj1: PutObject = {
    kind: 'flag',
    key: 'flag-1',
    version: 1,
    object: { key: 'flag-1', on: true },
  };
  const deleteObj: DeleteObject = {
    kind: 'segment',
    key: 'segment-1',
    version: 2,
  };
  const putObj2: PutObject = {
    kind: 'flag',
    key: 'flag-2',
    version: 3,
    object: { key: 'flag-2', on: false },
  };

  builder.start('xfer-full');
  builder.putObject(putObj1);
  builder.deleteObject(deleteObj);
  builder.putObject(putObj2);
  const result = builder.finish();

  expect(result.length).toBe(5); // server-intent + 3 events + payload-transferred
  expect(result[0].event).toBe('server-intent');
  expect(result[1].event).toBe('put-object');
  expect((result[1].data as PutObject).key).toBe('flag-1');
  expect(result[2].event).toBe('delete-object');
  expect((result[2].data as DeleteObject).key).toBe('segment-1');
  expect(result[3].event).toBe('put-object');
  expect((result[3].data as PutObject).key).toBe('flag-2');
  expect(result[4].event).toBe('payload-transferred');
});
