import type { HttpErrorResponse } from './Requests';

export type EventName = string;
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
  method?: string;
  headers: { [key: string]: string | string[] };
  body?: string;
  errorFilter: (err: HttpErrorResponse) => boolean;
  initialRetryDelayMillis: number;
  readTimeoutMillis: number;
  retryResetIntervalMillis: number;
}
