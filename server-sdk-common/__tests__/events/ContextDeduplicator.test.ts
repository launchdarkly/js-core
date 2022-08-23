import { Context } from '@launchdarkly/js-sdk-common';
import ContextDeduplicator from '../../src/events/ContextDeduplicator';

it('when contexts are processed to the capacity', () => {
  const max = 5;
  const deduplicator = new ContextDeduplicator(
    { contextKeysCapacity: max, contextKeysFlushInterval: 300 },
  );
  // Fill the cache with integers.
  for (let i = 0; i < max; i += 1) {
    expect(deduplicator.processContext(Context.fromLDContext({ key: `${i}` }))).toEqual(true);
  }

  // Check they are all there.
  for (let i = 0; i < max; i += 1) {
    expect(deduplicator.processContext(Context.fromLDContext({ key: `${i}` }))).toEqual(false);
  }
});

it('when the context capacity is exceeded', () => {
  const max = 5;
  const deduplicator = new ContextDeduplicator(
    { contextKeysCapacity: max, contextKeysFlushInterval: 300 },
  );
  // Fill the cache with integers.
  for (let i = 0; i < max + 10; i += 1) {
    expect(deduplicator.processContext(Context.fromLDContext({ key: `${i}` }))).toEqual(true);
  }

  // The earlier contexts have been evicted, so they will need sent again.
  for (let i = 0; i < 10; i += 1) {
    expect(deduplicator.processContext(Context.fromLDContext({ key: `${i}` }))).toEqual(true);
  }
});

it('when it has been flushed', () => {
  const max = 5;
  const deduplicator = new ContextDeduplicator(
    { contextKeysCapacity: max, contextKeysFlushInterval: 300 },
  );
  // Fill the cache with integers.
  for (let i = 0; i < max; i += 1) {
    expect(deduplicator.processContext(Context.fromLDContext({ key: `${i}` }))).toEqual(true);
  }

  deduplicator.flush();

  for (let i = 0; i < max; i += 1) {
    expect(deduplicator.processContext(Context.fromLDContext({ key: `${i}` }))).toEqual(true);
  }
});

it('when a context is re-used before the cache is full', () => {
  const max = 5;
  const deduplicator = new ContextDeduplicator(
    { contextKeysCapacity: max, contextKeysFlushInterval: 300 },
  );

  expect(deduplicator.processContext(Context.fromLDContext({ key: 'the key' }))).toEqual(true);
  expect(deduplicator.processContext(Context.fromLDContext({ key: 'the key' }))).toEqual(false);
});
