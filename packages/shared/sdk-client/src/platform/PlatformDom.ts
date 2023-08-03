export interface Storage {
  get(key: string): Promise<string | null>;

  set(key: string, value: string): Promise<boolean>;

  clear(): Promise<void>;
}

export interface PlatformDom {
  storage: Storage;
}
