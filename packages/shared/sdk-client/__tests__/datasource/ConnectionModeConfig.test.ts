import {
  BACKGROUND_POLL_INTERVAL_SECONDS,
  getFDv2ConnectionModeNames,
  getModeDefinition,
  isValidFDv2ConnectionMode,
  MODE_TABLE,
} from '../../src/datasource/ConnectionModeConfig';

it('defines entries for all five connection modes', () => {
  const expectedModes = ['streaming', 'polling', 'offline', 'one-shot', 'background'];
  expect(Object.keys(MODE_TABLE).sort()).toEqual(expectedModes.sort());
});

it('defines streaming mode with cache and polling initializers', () => {
  const def = getModeDefinition('streaming');
  expect(def.initializers).toEqual([{ type: 'cache' }, { type: 'polling' }]);
});

it('defines streaming mode with streaming and polling synchronizers', () => {
  const def = getModeDefinition('streaming');
  expect(def.synchronizers).toEqual([{ type: 'streaming' }, { type: 'polling' }]);
});

it('defines polling mode with cache initializer only', () => {
  const def = getModeDefinition('polling');
  expect(def.initializers).toEqual([{ type: 'cache' }]);
});

it('defines polling mode with polling synchronizer only', () => {
  const def = getModeDefinition('polling');
  expect(def.synchronizers).toEqual([{ type: 'polling' }]);
});

it('defines offline mode with cache initializer and no synchronizers', () => {
  const def = getModeDefinition('offline');
  expect(def.initializers).toEqual([{ type: 'cache' }]);
  expect(def.synchronizers).toEqual([]);
});

it('defines one-shot mode with cache, polling, and streaming initializers', () => {
  const def = getModeDefinition('one-shot');
  expect(def.initializers).toEqual([{ type: 'cache' }, { type: 'polling' }, { type: 'streaming' }]);
});

it('defines one-shot mode with no synchronizers', () => {
  const def = getModeDefinition('one-shot');
  expect(def.synchronizers).toEqual([]);
});

it('defines background mode with cache initializer', () => {
  const def = getModeDefinition('background');
  expect(def.initializers).toEqual([{ type: 'cache' }]);
});

it('defines background mode with polling synchronizer at 1 hour interval', () => {
  const def = getModeDefinition('background');
  expect(def.synchronizers).toHaveLength(1);
  const sync = def.synchronizers[0];
  expect(sync.type).toBe('polling');
  if (sync.type === 'polling') {
    expect(sync.pollInterval).toBe(3600);
  }
});

it('exports BACKGROUND_POLL_INTERVAL_SECONDS as 3600', () => {
  expect(BACKGROUND_POLL_INTERVAL_SECONDS).toBe(3600);
});

it('returns true for all valid FDv2 connection modes', () => {
  expect(isValidFDv2ConnectionMode('streaming')).toBe(true);
  expect(isValidFDv2ConnectionMode('polling')).toBe(true);
  expect(isValidFDv2ConnectionMode('offline')).toBe(true);
  expect(isValidFDv2ConnectionMode('one-shot')).toBe(true);
  expect(isValidFDv2ConnectionMode('background')).toBe(true);
});

it('returns false for invalid connection mode strings', () => {
  expect(isValidFDv2ConnectionMode('invalid')).toBe(false);
  expect(isValidFDv2ConnectionMode('')).toBe(false);
  expect(isValidFDv2ConnectionMode('STREAMING')).toBe(false);
});

it('returns all five connection mode names', () => {
  const names = getFDv2ConnectionModeNames();
  expect(names).toHaveLength(5);
  expect(names).toContain('streaming');
  expect(names).toContain('polling');
  expect(names).toContain('offline');
  expect(names).toContain('one-shot');
  expect(names).toContain('background');
});
