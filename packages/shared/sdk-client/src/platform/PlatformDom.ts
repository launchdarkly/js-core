export interface Storage {
  get(key: string): Promise<string | null>;

  set(key: string, value: string): void;

  clear(): void;
}

export interface PlatformDom {
  storage: Storage;
}
