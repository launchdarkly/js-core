import { FDv2SourceResult } from '../../../src/datasource/fdv2/FDv2SourceResult';
import { Initializer } from '../../../src/datasource/fdv2/Initializer';
import {
  createSourceManager,
  createSynchronizerSlot,
  InitializerFactory,
  SynchronizerFactory,
  SynchronizerSlot,
} from '../../../src/datasource/fdv2/SourceManager';
import { Synchronizer } from '../../../src/datasource/fdv2/Synchronizer';

function makeMockInitializer(): Initializer & { closed: boolean } {
  return {
    closed: false,
    run: jest.fn<Promise<FDv2SourceResult>, []>().mockResolvedValue({
      type: 'status',
      state: 'shutdown',
      fdv1Fallback: false,
    }),
    close() {
      this.closed = true;
    },
  };
}

function makeMockSynchronizer(): Synchronizer & { closed: boolean } {
  return {
    closed: false,
    next: jest.fn<Promise<FDv2SourceResult>, []>().mockResolvedValue({
      type: 'status',
      state: 'shutdown',
      fdv1Fallback: false,
    }),
    close() {
      this.closed = true;
    },
  };
}

function makeInitFactory(init: Initializer): InitializerFactory {
  return jest.fn(() => init);
}

function makeSyncFactory(sync: Synchronizer): SynchronizerFactory {
  return jest.fn(() => sync);
}

// -- createSynchronizerSlot --

it('creates an available synchronizer slot by default', () => {
  const factory: SynchronizerFactory = jest.fn();
  const slot = createSynchronizerSlot(factory);

  expect(slot.state).toBe('available');
  expect(slot.isFDv1Fallback).toBe(false);
});

it('creates a blocked synchronizer slot for FDv1 fallback', () => {
  const factory: SynchronizerFactory = jest.fn();
  const slot = createSynchronizerSlot(factory, { isFDv1Fallback: true });

  expect(slot.state).toBe('blocked');
  expect(slot.isFDv1Fallback).toBe(true);
});

it('allows overriding synchronizer slot initial state', () => {
  const factory: SynchronizerFactory = jest.fn();
  const slot = createSynchronizerSlot(factory, {
    isFDv1Fallback: true,
    initialState: 'available',
  });

  expect(slot.state).toBe('available');
  expect(slot.isFDv1Fallback).toBe(true);
});

// -- initializers --

it('iterates initializers in order', () => {
  const init1 = makeMockInitializer();
  const init2 = makeMockInitializer();
  const factory1 = makeInitFactory(init1);
  const factory2 = makeInitFactory(init2);

  const manager = createSourceManager([factory1, factory2], [], () => undefined);

  expect(manager.getNextInitializerAndSetActive()).toBe(init1);
  expect(factory1).toHaveBeenCalledWith(expect.any(Function));

  expect(manager.getNextInitializerAndSetActive()).toBe(init2);
  expect(factory2).toHaveBeenCalledWith(expect.any(Function));
});

it('returns undefined when all initializers are exhausted', () => {
  const init1 = makeMockInitializer();
  const manager = createSourceManager([makeInitFactory(init1)], [], () => undefined);

  manager.getNextInitializerAndSetActive();
  expect(manager.getNextInitializerAndSetActive()).toBeUndefined();
});

it('returns undefined immediately for empty initializer list', () => {
  const manager = createSourceManager([], [], () => undefined);
  expect(manager.getNextInitializerAndSetActive()).toBeUndefined();
});

it('closes the previous active source when getting next initializer', () => {
  const init1 = makeMockInitializer();
  const init2 = makeMockInitializer();
  const manager = createSourceManager(
    [makeInitFactory(init1), makeInitFactory(init2)],
    [],
    () => undefined,
  );

  manager.getNextInitializerAndSetActive();
  expect(init1.closed).toBe(false);

  manager.getNextInitializerAndSetActive();
  expect(init1.closed).toBe(true);
  expect(init2.closed).toBe(false);
});

it('passes selectorGetter to initializer factories', () => {
  const selectorGetter = () => 'test-selector';
  const factory = jest.fn(() => makeMockInitializer());
  const manager = createSourceManager([factory], [], selectorGetter);

  manager.getNextInitializerAndSetActive();
  expect(factory).toHaveBeenCalledWith(selectorGetter);
});

// -- synchronizers --

it('iterates available synchronizers in order', () => {
  const sync1 = makeMockSynchronizer();
  const sync2 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(sync1)),
    createSynchronizerSlot(makeSyncFactory(sync2)),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync1);
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync2);
});

it('skips blocked synchronizers', () => {
  const sync1 = makeMockSynchronizer();
  const sync2 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(sync1)),
    createSynchronizerSlot(makeSyncFactory(sync2)),
  ];
  slots[0].state = 'blocked';

  const manager = createSourceManager([], slots, () => undefined);

  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync2);
});

it('returns undefined when all synchronizers are blocked', () => {
  const sync1 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(makeSyncFactory(sync1))];
  slots[0].state = 'blocked';

  const manager = createSourceManager([], slots, () => undefined);

  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBeUndefined();
});

it('wraps around to find available synchronizers', () => {
  const sync1a = makeMockSynchronizer();
  const sync1b = makeMockSynchronizer();
  const factory1 = jest.fn<Synchronizer, [() => string | undefined]>();
  factory1.mockReturnValueOnce(sync1a).mockReturnValueOnce(sync1b);
  const sync2 = makeMockSynchronizer();

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(factory1),
    createSynchronizerSlot(makeSyncFactory(sync2)),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  // Visit both
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync1a);
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync2);

  // Wraps back to sync1 (new instance from factory)
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync1b);
});

it('wraps around and skips blocked synchronizers', () => {
  const sync1 = makeMockSynchronizer();
  const sync2a = makeMockSynchronizer();
  const sync2b = makeMockSynchronizer();
  const factory2 = jest.fn<Synchronizer, [() => string | undefined]>();
  factory2.mockReturnValueOnce(sync2a).mockReturnValueOnce(sync2b);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(sync1)),
    createSynchronizerSlot(factory2),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync1);
  // Block sync1
  manager.blockCurrentSynchronizer();
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync2a);
  // Wrapping: sync1 is blocked, wraps to sync2 again
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync2b);
});

it('returns undefined for empty synchronizer list', () => {
  const manager = createSourceManager([], [], () => undefined);
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBeUndefined();
});

it('closes the previous active source when getting next synchronizer', () => {
  const sync1 = makeMockSynchronizer();
  const sync2 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(sync1)),
    createSynchronizerSlot(makeSyncFactory(sync2)),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  manager.getNextAvailableSynchronizerAndSetActive();
  expect(sync1.closed).toBe(false);

  manager.getNextAvailableSynchronizerAndSetActive();
  expect(sync1.closed).toBe(true);
});

it('closes previous initializer when switching to synchronizer', () => {
  const init = makeMockInitializer();
  const sync = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(makeSyncFactory(sync))];

  const manager = createSourceManager([makeInitFactory(init)], slots, () => undefined);

  manager.getNextInitializerAndSetActive();
  expect(init.closed).toBe(false);

  manager.getNextAvailableSynchronizerAndSetActive();
  expect(init.closed).toBe(true);
});

// -- blocking --

it('blocks the current synchronizer', () => {
  const sync1 = makeMockSynchronizer();
  const sync2 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(sync1)),
    createSynchronizerSlot(makeSyncFactory(sync2)),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  manager.getNextAvailableSynchronizerAndSetActive();
  manager.blockCurrentSynchronizer();

  expect(slots[0].state).toBe('blocked');
  expect(slots[1].state).toBe('available');
});

// -- resetSourceIndex --

it('resetSourceIndex allows re-iteration from the beginning', () => {
  const sync1a = makeMockSynchronizer();
  const sync1b = makeMockSynchronizer();
  const factory1 = jest.fn<Synchronizer, [() => string | undefined]>();
  factory1.mockReturnValueOnce(sync1a).mockReturnValueOnce(sync1b);

  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(factory1),
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  // Get first synchronizer
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync1a);

  // Reset and start over — should go back to slot 0
  manager.resetSourceIndex();
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(sync1b);
});

// -- fdv1Fallback --

it('fdv1Fallback blocks all non-FDv1 and unblocks FDv1 synchronizers', () => {
  const syncNormal = makeMockSynchronizer();
  const syncFdv1 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(syncNormal)),
    createSynchronizerSlot(makeSyncFactory(syncFdv1), { isFDv1Fallback: true }),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  manager.fdv1Fallback();

  expect(slots[0].state).toBe('blocked');
  expect(slots[1].state).toBe('available');
});

it('fdv1Fallback resets synchronizer index so FDv1 slot is found', () => {
  const syncNormal = makeMockSynchronizer();
  const syncFdv1 = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(syncFdv1), { isFDv1Fallback: true }),
    createSynchronizerSlot(makeSyncFactory(syncNormal)),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  // Get normal synchronizer (skips blocked FDv1)
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(syncNormal);

  // Trigger fdv1 fallback
  manager.fdv1Fallback();
  expect(slots[0].state).toBe('available');
  expect(slots[1].state).toBe('blocked');

  // Should find FDv1 slot at index 0 thanks to index reset
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBe(syncFdv1);
});

it('hasFDv1Fallback returns true when FDv1 slot exists', () => {
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(jest.fn(), { isFDv1Fallback: true })];

  const manager = createSourceManager([], slots, () => undefined);
  expect(manager.hasFDv1Fallback()).toBe(true);
});

it('hasFDv1Fallback returns false when no FDv1 slot exists', () => {
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(jest.fn())];

  const manager = createSourceManager([], slots, () => undefined);
  expect(manager.hasFDv1Fallback()).toBe(false);
});

// -- isPrimeSynchronizer --

it('isPrimeSynchronizer returns false when no synchronizer has been selected', () => {
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
  ];

  const manager = createSourceManager([], slots, () => undefined);

  expect(manager.isPrimeSynchronizer()).toBe(false);
});

it('isPrimeSynchronizer returns true for the first available synchronizer', () => {
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
  ];

  const manager = createSourceManager([], slots, () => undefined);
  manager.getNextAvailableSynchronizerAndSetActive();

  expect(manager.isPrimeSynchronizer()).toBe(true);
});

it('isPrimeSynchronizer returns false for non-first synchronizer', () => {
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
  ];

  const manager = createSourceManager([], slots, () => undefined);
  manager.getNextAvailableSynchronizerAndSetActive();
  manager.getNextAvailableSynchronizerAndSetActive();

  expect(manager.isPrimeSynchronizer()).toBe(false);
});

it('isPrimeSynchronizer returns true when first slot is blocked and second is first available', () => {
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
  ];
  slots[0].state = 'blocked';

  const manager = createSourceManager([], slots, () => undefined);
  manager.getNextAvailableSynchronizerAndSetActive();

  expect(manager.isPrimeSynchronizer()).toBe(true);
});

// -- getAvailableSynchronizerCount --

it('counts available synchronizers excluding blocked ones', () => {
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(jest.fn()),
    createSynchronizerSlot(jest.fn()),
    createSynchronizerSlot(jest.fn(), { isFDv1Fallback: true }),
  ];

  const manager = createSourceManager([], slots, () => undefined);
  expect(manager.getAvailableSynchronizerCount()).toBe(2);
});

it('getAvailableSynchronizerCount updates when slots are blocked', () => {
  const slots: SynchronizerSlot[] = [
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
    createSynchronizerSlot(makeSyncFactory(makeMockSynchronizer())),
  ];

  const manager = createSourceManager([], slots, () => undefined);
  expect(manager.getAvailableSynchronizerCount()).toBe(3);

  manager.getNextAvailableSynchronizerAndSetActive();
  manager.blockCurrentSynchronizer();
  expect(manager.getAvailableSynchronizerCount()).toBe(2);

  manager.getNextAvailableSynchronizerAndSetActive();
  manager.blockCurrentSynchronizer();
  expect(manager.getAvailableSynchronizerCount()).toBe(1);

  manager.getNextAvailableSynchronizerAndSetActive();
  manager.blockCurrentSynchronizer();
  expect(manager.getAvailableSynchronizerCount()).toBe(0);
});

// -- close --

it('close closes the active source', () => {
  const sync = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(makeSyncFactory(sync))];

  const manager = createSourceManager([], slots, () => undefined);
  manager.getNextAvailableSynchronizerAndSetActive();

  manager.close();
  expect(sync.closed).toBe(true);
});

it('close sets isShutdown to true', () => {
  const manager = createSourceManager([], [], () => undefined);
  expect(manager.isShutdown).toBe(false);

  manager.close();
  expect(manager.isShutdown).toBe(true);
});

it('close can be called multiple times without error', () => {
  const sync = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(makeSyncFactory(sync))];

  const manager = createSourceManager([], slots, () => undefined);
  manager.getNextAvailableSynchronizerAndSetActive();

  manager.close();
  manager.close();
  manager.close();

  // Should not throw, and source should only be closed once
  expect(sync.closed).toBe(true);
});

it('close prevents further gets', () => {
  const init = makeMockInitializer();
  const sync = makeMockSynchronizer();
  const slots: SynchronizerSlot[] = [createSynchronizerSlot(makeSyncFactory(sync))];

  const manager = createSourceManager([makeInitFactory(init)], slots, () => undefined);
  manager.close();

  expect(manager.getNextInitializerAndSetActive()).toBeUndefined();
  expect(manager.getNextAvailableSynchronizerAndSetActive()).toBeUndefined();
});
