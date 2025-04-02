import { EventListener, EventName, LDLogger } from '../../../src/api';
import { Payload } from '../../../src/internal/fdv2/payloadProcessor';
import { EventStream, PayloadStreamReader } from '../../../src/internal/fdv2/payloadStreamReader';


class MockEventStream implements EventStream {
  private _listeners: Record<EventName, EventListener> = {};

  addEventListener(eventName: EventName, listener: EventListener): void {
    this._listeners[eventName] = listener;
  }

  simulateEvent(eventName: EventName, event: { data?: string }) {
    this._listeners[eventName](event);
  }
}

it('it sets basis to true when intent code is xfer-full', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
});

it('it sets basis to false when intent code is xfer-changes', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-changes", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(false);
});

it('it handles xfer-full then xfer-changes', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });

  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 456, "object": {"objectFieldA": "newValue"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(2);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
  expect(receivedPayloads[0].updates.length).toEqual(1);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldA: 'objectValueA' });
  expect(receivedPayloads[0].updates[0].deleted).toEqual(undefined);

  expect(receivedPayloads[1].id).toEqual('mockId');
  expect(receivedPayloads[1].state).toEqual('mockState');
  expect(receivedPayloads[1].basis).toEqual(false);
  expect(receivedPayloads[1].updates.length).toEqual(1);
  expect(receivedPayloads[1].updates[0].object).toEqual({ objectFieldA: 'newValue' });
  expect(receivedPayloads[1].updates[0].deleted).toEqual(undefined);
});

it('it includes multiple types of updates in payload', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('delete-object', {
    data: '{"kind": "mockKind", "key": "flagB", "version": 123}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagC", "version": 123, "object": {"objectFieldC": "objectValueC"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
  expect(receivedPayloads[0].updates.length).toEqual(3);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldA: 'objectValueA' });
  expect(receivedPayloads[0].updates[0].deleted).toEqual(undefined);
  expect(receivedPayloads[0].updates[1].object).toEqual(undefined);
  expect(receivedPayloads[0].updates[1].deleted).toEqual(true);
  expect(receivedPayloads[0].updates[2].object).toEqual({ objectFieldC: 'objectValueC' });
  expect(receivedPayloads[0].updates[2].deleted).toEqual(undefined);
});

it('it does not include messages thats are not between server-intent and payloader-transferred', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagShouldIgnore", "version": 123, "object": {"objectFieldShouldIgnore": "objectValueShouldIgnore"}}',
  });
  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].updates.length).toEqual(1);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldA: 'objectValueA' });
});

it('logs prescribed message when goodbye event is encountered', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(
    mockStream,
    {
      mockKind: (it) => it, // obj processor that just returns the same obj
    },
    undefined,
    mockLogger,
  );
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('goodbye', {
    data: '{"reason": "Bye"}',
  });

  expect(receivedPayloads.length).toEqual(0);
  expect(mockLogger.info).toHaveBeenCalledWith(
    'Goodbye was received from the LaunchDarkly connection with reason: Bye.',
  );
});

it('logs prescribed message when error event is encountered', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(
    mockStream,
    {
      mockKind: (it) => it, // obj processor that just returns the same obj
    },
    undefined,
    mockLogger,
  );
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('error', {
    data: '{"reason": "Womp womp"}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagB", "version": 123, "object": {"objectFieldB": "objectValueB"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(mockLogger.info).toHaveBeenCalledWith(
    'An issue was encountered receiving updates for payload mockId with reason: Womp womp.',
  );
});

it('discards partially transferred data when an error is encountered', () => {
  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(
    mockStream,
    {
      mockKind: (it) => it, // obj processor that just returns the same obj
    },
    undefined,
    mockLogger,
  );
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('error', {
    data: '{"reason": "Womp womp"}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagB", "version": 123, "object": {"objectFieldB": "objectValueB"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId2"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagX", "version": 123, "object": {"objectFieldX": "objectValueX"}}',
  });
  mockStream.simulateEvent('delete-object', {
    data: '{"kind": "mockKind", "key": "flagY", "version": 123}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagZ", "version": 123, "object": {"objectFieldZ": "objectValueZ"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState2", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(2);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
  expect(receivedPayloads[0].updates.length).toEqual(1);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldB: 'objectValueB' });
  expect(receivedPayloads[0].updates[0].deleted).toEqual(undefined);
  expect(receivedPayloads[1].id).toEqual('mockId2');
  expect(receivedPayloads[1].state).toEqual('mockState2');
  expect(receivedPayloads[1].basis).toEqual(true);
  expect(receivedPayloads[1].updates.length).toEqual(3);
  expect(receivedPayloads[1].updates[0].object).toEqual({ objectFieldX: 'objectValueX' });
  expect(receivedPayloads[1].updates[0].deleted).toEqual(undefined);
  expect(receivedPayloads[1].updates[1].object).toEqual(undefined);
  expect(receivedPayloads[1].updates[1].deleted).toEqual(true);
  expect(receivedPayloads[1].updates[2].object).toEqual({ objectFieldZ: 'objectValueZ' });
  expect(receivedPayloads[1].updates[2].deleted).toEqual(undefined);
});

it('silently ignores unrecognized kinds', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "ItsMeYourBrotherUnrecognizedKind", "key": "unrecognized", "version": 123, "object": {"unrecognized": "unrecognized"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
  expect(receivedPayloads[0].updates.length).toEqual(1);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldA: 'objectValueA' });
});

it('ignores additional payloads beyond the first payload in the server-intent message', () => {
  const mockStream = new MockEventStream();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadStreamReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"payloads": [{"code": "xfer-full", "id": "mockId"},{"code": "IShouldBeIgnored", "id": "IShouldBeIgnored"}]}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"kind": "ItsMeYourBrotherUnrecognizedKind", "key": "unrecognized", "version": 123, "object": {"unrecognized": "unrecognized"}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"state": "mockState", "version": 1}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
  expect(receivedPayloads[0].updates.length).toEqual(1);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldA: 'objectValueA' });
});
