export interface Storage {
  get: (key: string) => Promise<string>;
  set: (key: string, value: string) => Promise<void>;
  clear: (key: string) => Promise<void>;
}
