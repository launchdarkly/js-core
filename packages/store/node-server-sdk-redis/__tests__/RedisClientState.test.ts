import { EventEmitter } from 'events';

import RedisClientState from '../src/RedisClientState';

afterEach(() => {
  jest.useRealTimers();
});

it('anchors the disconnect time at the first close event', () => {
  jest.useFakeTimers();
  const client = new EventEmitter();
  // @ts-ignore Partial client mock for testing.
  const state = new RedisClientState({ client });

  client.emit('close');
  jest.advanceTimersByTime(5000);
  // The close event fires again on every failed reconnect attempt. A restart of the
  // clock here would keep the fail-fast grace period from ever elapsing.
  client.emit('close');
  jest.advanceTimersByTime(5000);

  expect(state.isConnected()).toBe(false);
  expect(state.disconnectedForMs()).toBe(10000);
});

it('reports a zero disconnect time after the connection is ready again', () => {
  jest.useFakeTimers();
  const client = new EventEmitter();
  // @ts-ignore Partial client mock for testing.
  const state = new RedisClientState({ client });

  client.emit('close');
  jest.advanceTimersByTime(5000);
  client.emit('ready');

  expect(state.isConnected()).toBe(true);
  expect(state.disconnectedForMs()).toBe(0);
});
