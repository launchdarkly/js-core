import * as LDClient from 'launchdarkly-js-client-sdk';
import { get } from 'svelte/store';
import { afterAll, afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { LD } from '../SvelteLDClient.js';

vi.mock('launchdarkly-js-client-sdk', async (importActual) => {
  const actual = (await importActual()) as typeof LDClient;
  return {
    ...actual,
    initialize: vi.fn(),
  };
});

const clientSideID = 'test-client-side-id';
const rawFlags = { 'test-flag': true, 'another-test-flag': true };
const mockLDClient = {
  on: vi.fn((e: string, cb: () => void) => {
    cb();
  }),
  off: vi.fn(),
  allFlags: vi.fn().mockReturnValue({}),
  variation: vi.fn(),
  waitForInitialization: vi.fn(),
  waitUntilReady: vi.fn().mockResolvedValue(undefined),
  identify: vi.fn(),
};
const mockInitialize = LDClient.initialize as Mock;
const mockAllFlags = mockLDClient.allFlags as Mock;

describe('launchDarkly', () => {
  describe('createLD', () => {
    it('should create a LaunchDarkly instance with correct properties', () => {
      const ld = LD;
      expect(typeof ld).toBe('object');
      expect(ld).toHaveProperty('identify');
      expect(ld).toHaveProperty('flags');
      expect(ld).toHaveProperty('initialize');
      expect(ld).toHaveProperty('initializing');
      expect(ld).toHaveProperty('watch');
      expect(ld).toHaveProperty('isOn');
    });

    describe('initialize', async () => {
      let ld = LD;
      beforeEach(() => {
        mockInitialize.mockImplementation(() => mockLDClient);
        mockAllFlags.mockImplementation(() => rawFlags);
      });

      afterEach(() => {
        mockInitialize.mockClear();
        mockAllFlags.mockClear();
      });

      afterAll(() => {
        vi.clearAllMocks();
      });

      it('should throw an error if the client is not initialized', async () => {
        ld = LD;
        expect(() => ld.isOn('test-flag')).toThrow('LaunchDarkly client not initialized');
        await expect(() => ld.identify({ key: 'user1' })).rejects.toThrow(
          'LaunchDarkly client not initialized',
        );
      });

      it('should set the loading status to false when the client is ready', async () => {
        const { initializing } = ld;
        ld.initialize('clientId', { key: 'user1' });

        // wait for next tick
        await new Promise((r) => {
          setTimeout(r);
        });

        const initializingValue = get(initializing);
        expect(initializingValue).toBe(false);
      });
      it('should initialize the LaunchDarkly SDK instance', () => {
        const initializeSpy = vi.spyOn(LDClient, 'initialize');

        ld.initialize('clientId', { key: 'user1' });
        expect(initializeSpy).toHaveBeenCalledWith('clientId', { key: 'user1' });
      });

      it('should call waitUntilReady when initializing', () => {
        const waitUntilReadySpy = vi.spyOn(mockLDClient, 'waitUntilReady');

        ld.initialize('clientId', { key: 'user1' });

        expect(waitUntilReadySpy).toHaveBeenCalled();
      });

      it('should register an event listener for the "change" event', () => {
        const onSpy = vi.spyOn(mockLDClient, 'on');

        ld.initialize('clientId ', { key: 'user1' });

        expect(onSpy).toHaveBeenCalled();
        expect(onSpy).toHaveBeenCalledWith('change', expect.any(Function));
      });

      it('should set flags when the client is ready', () => {
        const flagSubscriber = vi.fn();
        ld.initialize('clientId', { key: 'user1' });

        const subscribeSpy = vi.spyOn(ld.flags, 'subscribe');
        ld.flags.subscribe(flagSubscriber);

        expect(subscribeSpy).toBeDefined();
        expect(flagSubscriber).toHaveBeenCalledTimes(1);
        expect(flagSubscriber).toHaveBeenCalledWith(rawFlags);
      });
    });
    describe('watch function', () => {
      const ld = LD;
      beforeEach(() => {
        mockInitialize.mockImplementation(() => mockLDClient);
        mockAllFlags.mockImplementation(() => rawFlags);
      });

      it('should return a derived store that reflects the value of the specified flag', () => {
        const flagKey = 'test-flag';
        ld.initialize(clientSideID, { key: 'user1' });

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBe(true);
      });

      it('should update the flag store when the flag value changes', () => {
        const flagKey = 'test-flag';
        ld.initialize(clientSideID, { key: 'user1' });

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBe(true);

        mockAllFlags.mockReturnValue({ ...rawFlags, 'test-flag': false });

        // dispatch a change event on ldClient
        const changeCallback = mockLDClient.on.mock.calls[0][1];
        changeCallback();

        expect(get(flagStore)).toBe(false);
      });

      it('should return undefined if the flag is not found', () => {
        const flagKey = 'non-existent-flag';
        ld.initialize(clientSideID, { key: 'user1' });

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBeUndefined();
      });
    });

    describe('isOn function', () => {
      const ld = LD;
      beforeEach(() => {
        mockInitialize.mockImplementation(() => mockLDClient);
        mockAllFlags.mockImplementation(() => rawFlags);
      });

      it('should return true if the flag is on', () => {
        const flagKey = 'test-flag';
        ld.initialize(clientSideID, { key: 'user1' });

        expect(ld.isOn(flagKey)).toBe(true);
      });

      it('should return false if the flag is off', () => {
        const flagKey = 'test-flag';
        ld.initialize(clientSideID, { key: 'user1' });

        mockAllFlags.mockReturnValue({ ...rawFlags, 'test-flag': false });

        // dispatch a change event on ldClient
        const changeCallback = mockLDClient.on.mock.calls[0][1];
        changeCallback();

        expect(ld.isOn(flagKey)).toBe(false);
      });

      it('should return false if the flag is not found', () => {
        const flagKey = 'non-existent-flag';
        ld.initialize(clientSideID, { key: 'user1' });

        expect(ld.isOn(flagKey)).toBe(false);
      });
    });

    describe('identify function', () => {
      const ld = LD;
      beforeEach(() => {
        mockInitialize.mockImplementation(() => mockLDClient);
        mockAllFlags.mockImplementation(() => rawFlags);
      });

      it('should call the identify method on the LaunchDarkly client', () => {
        const user = { key: 'user1' };
        ld.initialize(clientSideID, user);

        ld.identify(user);

        expect(mockLDClient.identify).toHaveBeenCalledWith(user);
      });
    });

    describe('flags store', () => {
      const ld = LD;
      beforeEach(() => {
        mockInitialize.mockImplementation(() => mockLDClient);
        mockAllFlags.mockImplementation(() => rawFlags);
      });

      it('should return a readonly store of the flags', () => {
        ld.initialize(clientSideID, { key: 'user1' });

        const { flags } = ld;

        expect(get(flags)).toEqual(rawFlags);
      });

      it('should update the flags store when the flags change', () => {
        ld.initialize(clientSideID, { key: 'user1' });

        const { flags } = ld;

        expect(get(flags)).toEqual(rawFlags);

        const newFlags = { 'test-flag': false, 'another-test-flag': true };
        mockAllFlags.mockReturnValue(newFlags);

        // dispatch a change event on ldClient
        const changeCallback = mockLDClient.on.mock.calls[0][1];
        changeCallback();

        expect(get(flags)).toEqual(newFlags);
      });
    });
  });
});
