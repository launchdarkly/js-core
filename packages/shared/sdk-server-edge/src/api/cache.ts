export default interface Cache {
  get(key: string): any;
  set(key: string, value: any): void;
  close(): void;
}
