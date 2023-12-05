export interface Storage {
  get: (key: string) => Promise<string>;
  set: (key: string) => Promise<void>;
  clear: (key: string) => Promise<void>;
}
