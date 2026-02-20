import { fdv1PayloadAdaptor as FDv1PayloadAdaptor } from '../../../src/internal/fdv2/FDv1PayloadAdaptor';
import { PayloadProcessor } from '../../../src/internal/fdv2/payloadProcessor';
import { PutObject } from '../../../src/internal/fdv2/proto';
import { FDv2Event } from '../../../src/internal/fdv2/protocolHandler';

// Mock PayloadProcessor that captures events
class MockPayloadProcessor extends PayloadProcessor {
  public processedEvents: FDv2Event[] = [];

  constructor() {
    super({}, undefined, undefined);
  }

  override processEvents(events: FDv2Event[]) {
    this.processedEvents = [...this.processedEvents, ...events];
    // Don't call super.processEvents to avoid side effects in tests
  }
}

it('includes server-intent as the first event and payload-transferred as the last eventwith correct structure', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = FDv1PayloadAdaptor(processor);
  adaptor.processFullTransfer({ flags: {}, segments: {} });

  const serverIntentEvent = processor.processedEvents[0] as FDv2Event;
  expect(serverIntentEvent.event).toBe('server-intent');
  expect(serverIntentEvent.data).toBeDefined();

  const intentData = serverIntentEvent.data as any;
  expect(intentData.payloads).toBeDefined();
  expect(intentData.payloads.length).toBe(1);
  expect(intentData.payloads[0].intentCode).toBe('xfer-full');
  expect(intentData.payloads[0].id).toBe('FDv1Fallback');
  expect(intentData.payloads[0].target).toBe(1);
  expect(intentData.payloads[0].reason).toBe('payload-missing');

  const payloadTransferredEvent = processor.processedEvents[
    processor.processedEvents.length - 1
  ] as FDv2Event;
  expect(payloadTransferredEvent.event).toBe('payload-transferred');
  expect(payloadTransferredEvent.data).toBeDefined();

  const transferredData = payloadTransferredEvent.data as any;
  expect(transferredData.state).toBe('');
  expect(transferredData.version).toBe(1);
  expect(transferredData.id).toBe('FDv1Fallback');
});

it('pushFdv1Payload adds put-object events for flags and segments', () => {
  const processor = new MockPayloadProcessor();
  const adaptor = FDv1PayloadAdaptor(processor);
  const fdv1Payload = {
    flags: {
      'flag-1': { key: 'flag-1', version: 1, on: true },
      'flag-2': { key: 'flag-2', version: 2, on: false },
    },
    segments: {
      'segment-1': { key: 'segment-1', version: 1 },
    },
  };

  adaptor.processFullTransfer(fdv1Payload);

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
