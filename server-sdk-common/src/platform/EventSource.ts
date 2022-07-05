export interface EventSource {
  onclose: () => void;
  onerror: () => void;
  onopen: () => void;
  onretrying: () => void;

  addEventListener(type: string, listener: (event?: { data?: any }) => void): void;
  close(): void;
}

export interface EventSourceInitDict {
  errorFilter: (err: {
    status: number,
    message: string,
  }) => boolean,
  headers: { [key: string]: string },
  initialRetryDelayMillis: number,
  readTimeoutMillis: number,
  retryResetIntervalMillis: number,
}
