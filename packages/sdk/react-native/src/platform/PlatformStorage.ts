import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

import AsyncStorage from './ConditionalAsyncStorage';

export default class PlatformStorage implements Storage {
  constructor(private readonly _logger: LDLogger) {}
  async clear(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ?? null;
    } catch (error) {
      this._logger.debug(`Error getting AsyncStorage key: ${key}, error: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      this._logger.debug(`Error saving AsyncStorage key: ${key}, value: ${value}, error: ${error}`);
    }
  }
}
