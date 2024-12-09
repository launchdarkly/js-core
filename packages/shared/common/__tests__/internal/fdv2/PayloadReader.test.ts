import { EventListener, EventName } from '../../../src/api';
import { EventStream, Payload, PayloadReader } from '../../../src/internal/fdv2/payloadReader';

class MockEventStreamm implements EventStream {
  private _listeners: {
    [event: EventName]: EventListener;
  } = {};

  addEventListener(eventName: EventName, listener: EventListener): void {
    this._listeners[eventName] = listener;
  }

  simulateEvent(eventName: EventName, event: { data?: string }) {
    this._listeners[eventName](event);
  }
}

it('it sets basis to true when intent code is xfer-full', () => {
  const mockStream = new MockEventStreamm();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"data": {"payloads": [{"intentCode": "xfer-full", "id": "mockId"}]}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"data": {"state": "mockState", "version": 1}}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
});

it('it sets basis to false when intent code is xfer-changes', () => {
  const mockStream = new MockEventStreamm();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"data": {"payloads": [{"intentCode": "xfer-changes", "id": "mockId"}]}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"data": {"state": "mockState", "version": 1}}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(false);
});

it('it includes multiple types of updates in payload', () => {
  const mockStream = new MockEventStreamm();
  const receivedPayloads: Payload[] = [];
  const readerUnderTest = new PayloadReader(mockStream, {
    mockKind: (it) => it, // obj processor that just returns the same obj
  });
  readerUnderTest.addPayloadListener((it) => {
    receivedPayloads.push(it);
  });

  mockStream.simulateEvent('server-intent', {
    data: '{"data": {"payloads": [{"intentCode": "xfer-full", "id": "mockId"}]}}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"data": {"kind": "mockKind", "key": "flagA", "version": 123, "object": {"objectFieldA": "objectValueA"}}}',
  });
  mockStream.simulateEvent('delete-object', {
    data: '{"data": {"kind": "mockKind", "key": "flagB", "version": 123, "object": {"objectFieldB": "objectValueB"}}}',
  });
  mockStream.simulateEvent('put-object', {
    data: '{"data": {"kind": "mockKind", "key": "flagC", "version": 123, "object": {"objectFieldC": "objectValueC"}}}',
  });
  mockStream.simulateEvent('payload-transferred', {
    data: '{"data": {"state": "mockState", "version": 1}}',
  });
  expect(receivedPayloads.length).toEqual(1);
  expect(receivedPayloads[0].id).toEqual('mockId');
  expect(receivedPayloads[0].state).toEqual('mockState');
  expect(receivedPayloads[0].basis).toEqual(true);
  expect(receivedPayloads[0].updates.length).toEqual(3);
  expect(receivedPayloads[0].updates[0].object).toEqual({ objectFieldA: 'objectValueA' });
  expect(receivedPayloads[0].updates[0].deleted).toEqual(false); // TODO: resume at deciding if deleted should be optional (it is at the moment and causing this to fail)
  expect(receivedPayloads[0].updates[1].object).toEqual({ objectFieldB: 'objectValueB' });
  expect(receivedPayloads[0].updates[1].deleted).toEqual(true);
  expect(receivedPayloads[0].updates[2].object).toEqual({ objectFieldC: 'objectValueC' });
});

// it('it does not include messages thats are not between server-intent and payloader-transferred', () => {

// });

// it('logs prescribed message when goodbye event is encountered', () => {

// });

// it('logs prescribed message when error event is encountered', () => {

// });

// it('discards partially transferred data when an error is encountered', () => {

// });

// it('silently ignores unrecognized kinds', () => {

// });

// it('ignores additional payloads beyond the first payload in the server-intent message', () => {

// });
