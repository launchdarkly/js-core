import FDv1PayloadAdaptor from '../../../src/internal/fdv2/FDv1PayloadAdaptor';
import { PayloadProcessor } from '../../../src/internal/fdv2/payloadProcessor';
import { DeleteObject, Event, PutObject } from '../../../src/internal/fdv2/proto';

// Mock PayloadProcessor that captures events
class MockPayloadProcessor extends PayloadProcessor {
  public processedEvents: Event[] = [];

  constructor() {
    super({}, undefined, undefined);
  }

  override processEvents(events: Event[]) {
    this.processedEvents = [...this.processedEvents, ...events];
    // Don't call super.processEvents to avoid side effects in tests
  }
}

it('throws an error when using unsupported intent', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  // @ts-ignore - testing invalid intent
  expect(() => adaptor.start('invalid-intent')).toThrow('intent: only xfer-full is supported');
});

it('starts a new changeset with the given intent', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  adaptor.start('xfer-full');
  adaptor.finish();

  expect(processor.processedEvents.length).toBeGreaterThan(0);
  expect(processor.processedEvents[0].event).toBe('server-intent');
});

it('resets events when starting a new changeset', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  adaptor.start('xfer-full');
  adaptor.putObject({ kind: 'flag', key: 'test-flag', version: 1, object: {} });
  adaptor.start('xfer-full');
  adaptor.finish();

  // Should only have server-intent and payload-transferred, no put-object events
  const putObjectEvents = processor.processedEvents.filter((e) => e.event === 'put-object');
  expect(putObjectEvents.length).toBe(0);
});

it('includes server-intent as the first event with correct structure', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  adaptor.start('xfer-full');
  adaptor.finish();

  const serverIntentEvent = processor.processedEvents[0] as Event;
  expect(serverIntentEvent.event).toBe('server-intent');
  expect(serverIntentEvent.data).toBeDefined();

  const intentData = serverIntentEvent.data as any;
  expect(intentData.payloads).toBeDefined();
  expect(intentData.payloads.length).toBe(1);
  expect(intentData.payloads[0].intentCode).toBe('xfer-full');
  expect(intentData.payloads[0].id).toBe('FDv1Fallback');
  expect(intentData.payloads[0].target).toBe(1);
  expect(intentData.payloads[0].reason).toBe('payload-missing');
});

it('includes payload-transferred as the last event with empty state', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  adaptor.start('xfer-full');
  adaptor.finish();

  const payloadTransferredEvent = processor.processedEvents[
    processor.processedEvents.length - 1
  ] as Event;
  expect(payloadTransferredEvent.event).toBe('payload-transferred');
  expect(payloadTransferredEvent.data).toBeDefined();

  const transferredData = payloadTransferredEvent.data as any;
  expect(transferredData.state).toBe('');
  expect(transferredData.version).toBe(1);
  expect(transferredData.id).toBe('FDv1Fallback');
});

it('includes all put and delete events between server-intent and payload-transferred', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
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

  adaptor.start('xfer-full');
  adaptor.putObject(putObj1);
  adaptor.deleteObject(deleteObj);
  adaptor.putObject(putObj2);
  adaptor.finish();

  expect(processor.processedEvents.length).toBe(5); // server-intent + 3 events + payload-transferred
  expect(processor.processedEvents[0].event).toBe('server-intent');
  expect(processor.processedEvents[1].event).toBe('put-object');
  expect((processor.processedEvents[1].data as PutObject).key).toBe('flag-1');
  expect(processor.processedEvents[2].event).toBe('delete-object');
  expect((processor.processedEvents[2].data as DeleteObject).key).toBe('segment-1');
  expect(processor.processedEvents[3].event).toBe('put-object');
  expect((processor.processedEvents[3].data as PutObject).key).toBe('flag-2');
  expect(processor.processedEvents[4].event).toBe('payload-transferred');
});

it('clears events after finish is called', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  adaptor.start('xfer-full');
  adaptor.putObject({ kind: 'flag', key: 'test-flag', version: 1, object: {} });
  adaptor.finish();

  const firstFinishEventCount = processor.processedEvents.length;
  expect(firstFinishEventCount).toBe(3); // server-intent + put-object + payload-transferred

  // Start a new changeset
  adaptor.start('xfer-full');
  adaptor.finish();

  // Should have processed 2 more events (server-intent + payload-transferred)
  // but the adaptor's internal events should be cleared
  expect(processor.processedEvents.length).toBe(firstFinishEventCount + 2);
});

it('pushFdv1Payload adds put-object events for flags and segments', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  const fdv1Payload = {
    flags: {
      'flag-1': { key: 'flag-1', version: 1, on: true },
      'flag-2': { key: 'flag-2', version: 2, on: false },
    },
    segments: {
      'segment-1': { key: 'segment-1', version: 1 },
    },
  };

  adaptor.start('xfer-full');
  adaptor.pushFdv1Payload(fdv1Payload);
  adaptor.finish();

  const putObjectEvents = processor.processedEvents.filter((e) => e.event === 'put-object');
  expect(putObjectEvents.length).toBe(3);

  const flag1Event = putObjectEvents.find((e) => (e.data as PutObject).key === 'flag-1');
  expect(flag1Event).toBeDefined();
  expect((flag1Event!.data as PutObject).kind).toBe('flag');
  expect((flag1Event!.data as PutObject).version).toBe(1);

  const flag2Event = putObjectEvents.find((e) => (e.data as PutObject).key === 'flag-2');
  expect(flag2Event).toBeDefined();
  expect((flag2Event!.data as PutObject).kind).toBe('flag');
  expect((flag2Event!.data as PutObject).version).toBe(2);

  const segment1Event = putObjectEvents.find((e) => (e.data as PutObject).key === 'segment-1');
  expect(segment1Event).toBeDefined();
  expect((segment1Event!.data as PutObject).kind).toBe('segment');
  expect((segment1Event!.data as PutObject).version).toBe(1);
});

it('pushFdv1Payload handles empty or missing flags and segments', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);

  adaptor.start('xfer-full');
  adaptor.pushFdv1Payload({ flags: {}, segments: {} });
  adaptor.finish();

  const putObjectEvents = processor.processedEvents.filter((e) => e.event === 'put-object');
  expect(putObjectEvents.length).toBe(0);

  // Test with missing properties
  const processor2 = new MockPayloadProcessor();
  const adaptor2 = new FDv1PayloadAdaptor(processor2);
  adaptor2.start('xfer-full');
  adaptor2.pushFdv1Payload({} as any);
  adaptor2.finish();

  const putObjectEvents2 = processor2.processedEvents.filter((e) => e.event === 'put-object');
  expect(putObjectEvents2.length).toBe(0);
});

it('pushFdv1Payload uses default version of 1 when version is missing', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = new FDv1PayloadAdaptor(processor);
  const fdv1Payload = {
    flags: {
      'flag-1': { key: 'flag-1', on: true }, // no version
    },
    segments: {},
  };

  adaptor.start('xfer-full');
  adaptor.pushFdv1Payload(fdv1Payload);
  adaptor.finish();

  const putObjectEvents = processor.processedEvents.filter((e) => e.event === 'put-object');
  expect(putObjectEvents.length).toBe(1);
  expect((putObjectEvents[0].data as PutObject).version).toBe(1);
});
