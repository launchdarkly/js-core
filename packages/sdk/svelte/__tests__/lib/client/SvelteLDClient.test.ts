import { EventEmitter } from 'node:events';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { initialize, LDClient } from '@launchdarkly/js-client-sdk/compat';

import { LD } from '../../../src/lib/client/SvelteLDClient';

vi.mock('@launchdarkly/js-client-sdk/compat', { spy: true });

const clientSideID = 'test-client-side-id';
const rawFlags = { 'test-flag': true, 'another-test-flag': 'flag-value' };
const mockContext = { key: 'user1' };

// used to mock ready and change events on the LDClient
const mockLDEventEmitter = new EventEmitter();

const mockLDClient = {
  on: (e: string, cb: () => void) => mockLDEventEmitter.on(e, cb),
  off: vi.fn(),
  allFlags: vi.fn().mockReturnValue(rawFlags),
  variation: vi.fn((_, defaultValue) => defaultValue),
  identify: vi.fn(),
};

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
      expect(ld).toHaveProperty('useFlag');
    });

    describe('initialize', async () => {
      const ld = LD;

      beforeEach(() => {
        // mocks the initialize function to return the mockLDClient
        (initialize as Mock<typeof initialize>).mockReturnValue(
          mockLDClient as unknown as LDClient,
        );
      });

      afterEach(() => {
        vi.clearAllMocks();
        mockLDEventEmitter.removeAllListeners();
      });

      it('should throw an error if the client is not initialized', async () => {
        const flagKey = 'test-flag';
        const user = { key: 'user1' };

        expect(() => ld.useFlag(flagKey, true)).toThrow('LaunchDarkly client not initialized');
        await expect(() => ld.identify(user)).rejects.toThrow(
          'LaunchDarkly client not initialized',
        );
      });

      it('should set the loading status to false when the client is ready', async () => {
        const { initializing } = ld;
        ld.initialize(clientSideID, mockContext);

        expect(get(initializing)).toBe(true); // should be true before the ready event is emitted
        mockLDEventEmitter.emit('ready');

        expect(get(initializing)).toBe(false);
      });

      it('should initialize the LaunchDarkly SDK instance', () => {
        ld.initialize(clientSideID, mockContext);

        expect(initialize).toHaveBeenCalledWith('test-client-side-id', mockContext);
      });

      it('should register function that gets flag values when client is ready', () => {
        const newFlags = { ...rawFlags, 'new-flag': true };
        const allFlagsSpy = vi.spyOn(mockLDClient, 'allFlags').mockReturnValue(newFlags);

        ld.initialize(clientSideID, mockContext);
        mockLDEventEmitter.emit('ready');

        expect(allFlagsSpy).toHaveBeenCalledOnce();
        expect(allFlagsSpy).toHaveReturnedWith(newFlags);
      });

      it('should register function that gets flag values when flags changed', () => {
        const changedFlags = { ...rawFlags, 'changed-flag': true };
        const allFlagsSpy = vi.spyOn(mockLDClient, 'allFlags').mockReturnValue(changedFlags);

        ld.initialize(clientSideID, mockContext);
        mockLDEventEmitter.emit('change');

        expect(allFlagsSpy).toHaveBeenCalledOnce();
        expect(allFlagsSpy).toHaveReturnedWith(changedFlags);
      });
    });

    describe('watch function', () => {
      const ld = LD;

      beforeEach(() => {
        // mocks the initialize function to return the mockLDClient
        (initialize as Mock<typeof initialize>).mockReturnValue(
          mockLDClient as unknown as LDClient,
        );
      });

      afterEach(() => {
        vi.clearAllMocks();
        mockLDEventEmitter.removeAllListeners();
      });

      it('should return a derived store that reflects the value of the specified flag', () => {
        const flagKey = 'test-flag';
        ld.initialize(clientSideID, mockContext);

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBe(true);
      });

      it('should update the flag store when the flag value changes', () => {
        const booleanFlagKey = 'test-flag';
        const stringFlagKey = 'another-test-flag';
        ld.initialize(clientSideID, mockContext);
        const flagStore = ld.watch(booleanFlagKey);
        const flagStore2 = ld.watch(stringFlagKey);

        // emit ready event to set initial flag values
        mockLDEventEmitter.emit('ready');

        // 'test-flag' initial value is true according to `rawFlags`
        expect(get(flagStore)).toBe(true);
        // 'another-test-flag' intial value is 'flag-value' according to `rawFlags`
        expect(get(flagStore2)).toBe('flag-value');

        mockLDClient.allFlags.mockReturnValue({
          ...rawFlags,
          'test-flag': false,
          'another-test-flag': 'new-flag-value',
        });

        // dispatch a change event on ldClient
        mockLDEventEmitter.emit('change');

        expect(get(flagStore)).toBe(false);
        expect(get(flagStore2)).toBe('new-flag-value');
      });

      it('should return undefined if the flag is not found', () => {
        const flagKey = 'non-existent-flag';
        ld.initialize(clientSideID, mockContext);

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBeUndefined();
      });
    });

    describe('useFlag function', () => {
      const ld = LD;

      beforeEach(() => {
        // mocks the initialize function to return the mockLDClient
        (initialize as Mock<typeof initialize>).mockReturnValue(
          mockLDClient as unknown as LDClient,
        );
      });

      afterEach(() => {
        vi.clearAllMocks();
        mockLDEventEmitter.removeAllListeners();
      });

      it('should return flag value', () => {
        mockLDClient.variation.mockReturnValue(true);
        const flagKey = 'test-flag';
        ld.initialize(clientSideID, mockContext);

        expect(ld.useFlag(flagKey, false)).toBe(true);
        expect(mockLDClient.variation).toHaveBeenCalledWith(flagKey, false);
      });
    });

    describe('identify function', () => {
      const ld = LD;

      beforeEach(() => {
        // mocks the initialize function to return the mockLDClient
        (initialize as Mock<typeof initialize>).mockReturnValue(
          mockLDClient as unknown as LDClient,
        );
      });

      afterEach(() => {
        vi.clearAllMocks();
        mockLDEventEmitter.removeAllListeners();
      });

      it('should call the identify method on the LaunchDarkly client', () => {
        const user = { key: 'user1' };
        ld.initialize(clientSideID, user);

        ld.identify(user);

        expect(mockLDClient.identify).toHaveBeenCalledWith(user);
      });
    });
  });
});
