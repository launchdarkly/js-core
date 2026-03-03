import type { FDv2ConnectionMode, ModeResolutionTable, ModeState } from '../../src/api/datasource';
import {
  BROWSER_TRANSITION_TABLE,
  DESKTOP_TRANSITION_TABLE,
  MOBILE_TRANSITION_TABLE,
  resolveConnectionMode,
} from '../../src/datasource/ModeResolver';

function makeInput(overrides: Partial<ModeState> = {}): ModeState {
  return {
    lifecycle: 'foreground',
    networkAvailable: true,
    foregroundMode: 'streaming',
    backgroundMode: 'background',
    ...overrides,
  };
}

// -------------------------------- resolveConnectionMode ---------------------------------

describe('given a table with a catch-all entry', () => {
  const table: ModeResolutionTable = [{ conditions: {}, mode: { configured: 'foreground' } }];

  it('matches any input', () => {
    expect(resolveConnectionMode(table, makeInput())).toBe('streaming');
    expect(
      resolveConnectionMode(
        table,
        makeInput({ lifecycle: 'background', networkAvailable: false, foregroundMode: 'polling' }),
      ),
    ).toBe('polling');
  });
});

describe('given a single condition', () => {
  const table: ModeResolutionTable = [
    { conditions: { lifecycle: 'background' }, mode: { configured: 'background' } },
    { conditions: {}, mode: { configured: 'foreground' } },
  ];

  it('matches when the condition is satisfied', () => {
    expect(resolveConnectionMode(table, makeInput({ lifecycle: 'background' }))).toBe('background');
  });

  it('falls through when the condition is not satisfied', () => {
    expect(resolveConnectionMode(table, makeInput({ lifecycle: 'foreground' }))).toBe('streaming');
  });
});

describe('given multiple conditions on a single entry', () => {
  const table: ModeResolutionTable = [
    {
      conditions: { lifecycle: 'foreground', networkAvailable: true },
      mode: 'streaming',
    },
    { conditions: {}, mode: 'offline' },
  ];

  it('matches when all conditions are satisfied', () => {
    expect(
      resolveConnectionMode(table, makeInput({ lifecycle: 'foreground', networkAvailable: true })),
    ).toBe('streaming');
  });

  it('does not match when only some conditions are satisfied', () => {
    expect(
      resolveConnectionMode(table, makeInput({ lifecycle: 'foreground', networkAvailable: false })),
    ).toBe('offline');
  });
});

describe('given multiple matching entries', () => {
  const table: ModeResolutionTable = [
    { conditions: { networkAvailable: false }, mode: 'offline' },
    { conditions: { lifecycle: 'background' }, mode: { configured: 'background' } },
    { conditions: {}, mode: { configured: 'foreground' } },
  ];

  it('returns the first matching entry', () => {
    expect(
      resolveConnectionMode(table, makeInput({ networkAvailable: false, lifecycle: 'background' })),
    ).toBe('offline');
  });
});

it('resolves configured foreground to input.foregroundMode', () => {
  const table: ModeResolutionTable = [{ conditions: {}, mode: { configured: 'foreground' } }];

  const modes: FDv2ConnectionMode[] = ['streaming', 'polling', 'offline', 'one-shot', 'background'];
  modes.forEach((mode) => {
    expect(resolveConnectionMode(table, makeInput({ foregroundMode: mode }))).toBe(mode);
  });
});

it('resolves configured background to input.backgroundMode', () => {
  const table: ModeResolutionTable = [{ conditions: {}, mode: { configured: 'background' } }];

  const modes: FDv2ConnectionMode[] = ['streaming', 'polling', 'offline', 'one-shot', 'background'];
  modes.forEach((mode) => {
    expect(resolveConnectionMode(table, makeInput({ backgroundMode: mode }))).toBe(mode);
  });
});

it('resolves a literal mode directly', () => {
  const table: ModeResolutionTable = [{ conditions: {}, mode: 'offline' }];

  expect(resolveConnectionMode(table, makeInput({ foregroundMode: 'streaming' }))).toBe('offline');
});

it('falls back to foregroundMode when no entry matches (empty table)', () => {
  const table: ModeResolutionTable = [];

  expect(resolveConnectionMode(table, makeInput({ foregroundMode: 'polling' }))).toBe('polling');
});

// -------------------------------- MOBILE_TRANSITION_TABLE ---------------------------------

describe('given the mobile transition table', () => {
  it('returns offline when network is unavailable regardless of lifecycle', () => {
    expect(
      resolveConnectionMode(
        MOBILE_TRANSITION_TABLE,
        makeInput({ networkAvailable: false, lifecycle: 'foreground' }),
      ),
    ).toBe('offline');

    expect(
      resolveConnectionMode(
        MOBILE_TRANSITION_TABLE,
        makeInput({ networkAvailable: false, lifecycle: 'background' }),
      ),
    ).toBe('offline');
  });

  it('returns the configured foreground mode when in foreground with network', () => {
    expect(
      resolveConnectionMode(
        MOBILE_TRANSITION_TABLE,
        makeInput({ lifecycle: 'foreground', foregroundMode: 'streaming' }),
      ),
    ).toBe('streaming');

    expect(
      resolveConnectionMode(
        MOBILE_TRANSITION_TABLE,
        makeInput({ lifecycle: 'foreground', foregroundMode: 'polling' }),
      ),
    ).toBe('polling');
  });

  it('returns the configured background mode when in background with network', () => {
    expect(
      resolveConnectionMode(
        MOBILE_TRANSITION_TABLE,
        makeInput({ lifecycle: 'background', backgroundMode: 'background' }),
      ),
    ).toBe('background');

    expect(
      resolveConnectionMode(
        MOBILE_TRANSITION_TABLE,
        makeInput({ lifecycle: 'background', backgroundMode: 'offline' }),
      ),
    ).toBe('offline');
  });

  it('works with all FDv2ConnectionMode values as foreground config', () => {
    const modes: FDv2ConnectionMode[] = [
      'streaming',
      'polling',
      'offline',
      'one-shot',
      'background',
    ];
    modes.forEach((mode) => {
      expect(
        resolveConnectionMode(
          MOBILE_TRANSITION_TABLE,
          makeInput({ lifecycle: 'foreground', foregroundMode: mode }),
        ),
      ).toBe(mode);
    });
  });

  it('works with all FDv2ConnectionMode values as background config', () => {
    const modes: FDv2ConnectionMode[] = [
      'streaming',
      'polling',
      'offline',
      'one-shot',
      'background',
    ];
    modes.forEach((mode) => {
      expect(
        resolveConnectionMode(
          MOBILE_TRANSITION_TABLE,
          makeInput({ lifecycle: 'background', backgroundMode: mode }),
        ),
      ).toBe(mode);
    });
  });
});

// -------------------------------- BROWSER_TRANSITION_TABLE ---------------------------------

describe('given the browser transition table', () => {
  it('returns offline when network is unavailable', () => {
    expect(
      resolveConnectionMode(
        BROWSER_TRANSITION_TABLE,
        makeInput({ networkAvailable: false, foregroundMode: 'one-shot' }),
      ),
    ).toBe('offline');
  });

  it('returns the configured foreground mode when network is available', () => {
    expect(
      resolveConnectionMode(BROWSER_TRANSITION_TABLE, makeInput({ foregroundMode: 'one-shot' })),
    ).toBe('one-shot');

    expect(
      resolveConnectionMode(BROWSER_TRANSITION_TABLE, makeInput({ foregroundMode: 'streaming' })),
    ).toBe('streaming');

    expect(
      resolveConnectionMode(BROWSER_TRANSITION_TABLE, makeInput({ foregroundMode: 'polling' })),
    ).toBe('polling');
  });

  it('is not affected by lifecycle state', () => {
    expect(
      resolveConnectionMode(
        BROWSER_TRANSITION_TABLE,
        makeInput({ lifecycle: 'background', foregroundMode: 'one-shot' }),
      ),
    ).toBe('one-shot');
  });
});

// -------------------------------- DESKTOP_TRANSITION_TABLE ---------------------------------

describe('given the desktop transition table', () => {
  it('returns offline when network is unavailable', () => {
    expect(
      resolveConnectionMode(DESKTOP_TRANSITION_TABLE, makeInput({ networkAvailable: false })),
    ).toBe('offline');
  });

  it('returns the configured foreground mode when network is available', () => {
    expect(
      resolveConnectionMode(DESKTOP_TRANSITION_TABLE, makeInput({ foregroundMode: 'streaming' })),
    ).toBe('streaming');

    expect(
      resolveConnectionMode(DESKTOP_TRANSITION_TABLE, makeInput({ foregroundMode: 'polling' })),
    ).toBe('polling');
  });
});
