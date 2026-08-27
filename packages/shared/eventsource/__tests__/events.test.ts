import { ESEvent, ESMessageEvent } from '../src/events';

it('makes the event type a read-only enumerable property', () => {
  const event = new ESEvent('retrying');
  expect(event.type).toEqual('retrying');
  expect(Object.getOwnPropertyDescriptor(event, 'type')).toEqual({
    value: 'retrying',
    writable: false,
    enumerable: true,
    configurable: false,
  });
});

it('copies optional properties onto the event as read-only enumerable properties', () => {
  const event = new ESEvent('retrying', { delayMillis: 250 });
  expect(Object.keys(event).sort()).toEqual(['delayMillis', 'type']);
  expect(Object.getOwnPropertyDescriptor(event, 'delayMillis')).toEqual({
    value: 250,
    writable: false,
    enumerable: true,
    configurable: false,
  });
});

it('creates an event with no optional properties', () => {
  const event = new ESEvent('closed');
  expect(Object.keys(event)).toEqual(['type']);
});

it('creates a message event with enumerable read-only properties', () => {
  const event = new ESMessageEvent('message', {
    data: 'hello',
    lastEventId: '123',
    origin: 'http://localhost:8000',
  });
  expect(event.type).toEqual('message');
  expect(event.data).toEqual('hello');
  expect(event.lastEventId).toEqual('123');
  expect(event.origin).toEqual('http://localhost:8000');
  expect(Object.keys(event).sort()).toEqual(['data', 'lastEventId', 'origin', 'type']);
  expect(Object.getOwnPropertyDescriptor(event, 'data')).toEqual({
    value: 'hello',
    writable: false,
    enumerable: true,
    configurable: false,
  });
});
