import { EventEmitter } from 'node:events';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { initialize, LDClient } from '@launchdarkly/js-client-sdk';

import { LD } from '../../../src/lib/client/SvelteLDClient';

vi.mock('@launchdarkly/js-client-sdk', { spy: true });

const clientSideID = 'test-client-side-id';
const rawFlags = { 'test-flag': true, 'another-test-flag': 'flag-value' };

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
      expect(ld).toHaveProperty('isOn');
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

        expect(() => ld.isOn(flagKey)).toThrow('LaunchDarkly client not initialized');
        await expect(() => ld.identify(user)).rejects.toThrow(
          'LaunchDarkly client not initialized',
        );
      });

      it('should set the loading status to false when the client is ready', async () => {
        const { initializing } = ld;
        ld.initialize(clientSideID);

        expect(get(initializing)).toBe(true); // should be true before the ready event is emitted
        mockLDEventEmitter.emit('ready');

        expect(get(initializing)).toBe(false);
      });

      it('should initialize the LaunchDarkly SDK instance', () => {
        ld.initialize(clientSideID);

        expect(initialize).toHaveBeenCalledWith('test-client-side-id');
      });

      it('should register function that gets flag values when client is ready', () => {
        const newFlags = { ...rawFlags, 'new-flag': true };
        const allFlagsSpy = vi.spyOn(mockLDClient, 'allFlags').mockReturnValue(newFlags);

        ld.initialize(clientSideID);
        mockLDEventEmitter.emit('ready');

        expect(allFlagsSpy).toHaveBeenCalledOnce();
        expect(allFlagsSpy).toHaveReturnedWith(newFlags);
      });

      it('should register function that gets flag values when flags changed', () => {
        const changedFlags = { ...rawFlags, 'changed-flag': true };
        const allFlagsSpy = vi.spyOn(mockLDClient, 'allFlags').mockReturnValue(changedFlags);

        ld.initialize(clientSideID);
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
        ld.initialize(clientSideID);

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBe(true);
      });

      it('should update the flag store when the flag value changes', () => {
        const booleanFlagKey = 'test-flag';
        const stringFlagKey = 'another-test-flag';
        ld.initialize(clientSideID);
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
        ld.initialize(clientSideID);

        const flagStore = ld.watch(flagKey);

        expect(get(flagStore)).toBeUndefined();
      });
    });

    // TODO: fix these tests
    // describe('isOn function', () => {
    //   const ld = LD;

    //   beforeEach(() => {
    //     // mocks the initialize function to return the mockLDClient
    //     (initialize as Mock<typeof initialize>).mockReturnValue(
    //       mockLDClient as unknown as LDClient,
    //     );
    //   });

    //   afterEach(() => {
    //     vi.clearAllMocks();
    //     mockLDEventEmitter.removeAllListeners();
    //   });

    //   it('should return true if the flag is on', () => {
    //     const flagKey = 'test-flag';
    //     ld.initialize(clientSideID);

    //     expect(ld.isOn(flagKey)).toBe(true);
    //   });

    //   it('should return false if the flag is off', () => {
    //     const flagKey = 'test-flag';
    //     ld.initialize(clientSideID);

    //     mockAllFlags.mockReturnValue({ ...rawFlags, 'test-flag': false });

    //     // dispatch a change event on ldClient
    //     const changeCallback = mockLDClient.on.mock.calls[0][1];
    //     changeCallback();

    //     expect(ld.isOn(flagKey)).toBe(false);
    //   });

    //   it('should return false if the flag is not found', () => {
    //     const flagKey = 'non-existent-flag';
    //     ld.initialize(clientSideID, { key: 'user1' });

    //     expect(ld.isOn(flagKey)).toBe(false);
    //   });
    // });

    // describe('identify function', () => {
    //   const ld = LD;
    //   beforeEach(() => {
    //     mockInitialize.mockImplementation(() => mockLDClient);
    //     mockAllFlags.mockImplementation(() => rawFlags);
    //   });

    //   it('should call the identify method on the LaunchDarkly client', () => {
    //     const user = { key: 'user1' };
    //     ld.initialize(clientSideID, user);

    //     ld.identify(user);

    //     expect(mockLDClient.identify).toHaveBeenCalledWith(user);
    //   });
    // });

    // describe('flags store', () => {
    //   const ld = LD;
    //   beforeEach(() => {
    //     mockInitialize.mockImplementation(() => mockLDClient);
    //     mockAllFlags.mockImplementation(() => rawFlags);
    //   });

    //   it('should return a readonly store of the flags', () => {
    //     ld.initialize(clientSideID, { key: 'user1' });

    //     const { flags } = ld;

    //     expect(get(flags)).toEqual(rawFlags);
    //   });

    //   it('should update the flags store when the flags change', () => {
    //     ld.initialize(clientSideID, { key: 'user1' });

    //     const { flags } = ld;

    //     expect(get(flags)).toEqual(rawFlags);

    //     const newFlags = { 'test-flag': false, 'another-test-flag': true };
    //     mockAllFlags.mockReturnValue(newFlags);

    //     // dispatch a change event on ldClient
    //     const changeCallback = mockLDClient.on.mock.calls[0][1];
    //     changeCallback();

    //     expect(get(flags)).toEqual(newFlags);
    //   });
    // });
  });
});
