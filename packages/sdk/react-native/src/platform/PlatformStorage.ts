import type { LDLogger, Storage } from '@launchdarkly/js-client-sdk-common';

import getAsyncStorage from './ConditionalAsyncStorage';

export default class PlatformStorage implements Storage {
  private _asyncStorage: any;
  constructor(private readonly _logger: LDLogger) {
    this._asyncStorage = getAsyncStorage(_logger);
  }

  async clear(key: string): Promise<void> {
    await this._asyncStorage.removeItem(key);
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this._asyncStorage.getItem(key);
      return value ?? null;
    } catch (error) {
      this._logger.debug(`Error getting AsyncStorage key: ${key}, error: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this._asyncStorage.setItem(key, value);
    } catch (error) {
      this._logger.debug(`Error saving AsyncStorage key: ${key}, value: ${value}, error: ${error}`);
    }
  }
}
