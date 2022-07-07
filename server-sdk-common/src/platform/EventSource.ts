export interface EventSource {
  onclose: (() => void) | undefined;
  onerror: (() => void) | undefined;
  onopen: (() => void) | undefined;
  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  addEventListener(type: string, listener: (event?: { data?: any }) => void): void;
  close(): void;
}

export interface EventSourceInitDict {
  errorFilter: (err: {
    status: number,
    message: string,
  }) => boolean,
  headers: { [key: string]: string | string[] },
  initialRetryDelayMillis: number,
  readTimeoutMillis: number,
  retryResetIntervalMillis: number,
}
