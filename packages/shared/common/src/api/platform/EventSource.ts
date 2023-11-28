import type { HttpErrorResponse } from './Requests';

export type EventName = 'delete' | 'patch' | 'ping' | 'put';
export type EventListener = (event?: { data?: any }) => void;
export type ProcessStreamResponse = {
  deserializeData: (data: string) => any;
  processJson: (json: any) => void;
};

export interface EventSource {
  onclose: (() => void) | undefined;
  onerror: ((err?: HttpErrorResponse) => void) | undefined;
  onopen: (() => void) | undefined;
  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  addEventListener(type: EventName, listener: EventListener): void;
  close(): void;
}

export interface EventSourceInitDict {
  errorFilter: (err: HttpErrorResponse) => boolean;
  headers: { [key: string]: string | string[] };
  initialRetryDelayMillis: number;
  readTimeoutMillis: number;
  retryResetIntervalMillis: number;
}
