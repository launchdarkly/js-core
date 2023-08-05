import { Platform } from '@launchdarkly/js-sdk-common';

export interface Storage {
  get(key: string): Promise<string | null>;

  set(key: string, value: string): Promise<boolean>;

  clear(): Promise<void>;
}

export interface PlatformDom extends Platform {
  storage: Storage;
}
