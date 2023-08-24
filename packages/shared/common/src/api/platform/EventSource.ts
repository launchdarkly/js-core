import { VoidFunction } from '../../utils';

export type EventName = 'delete' | 'patch' | 'ping' | 'put';
export type EventListener = (event?: { data?: any }) => void;
export type ProcessStreamResponse = {
  deserialize: <T>(responseJson: string) => T;
  processJson: <T>(json: T) => void;
};

export interface EventSource {
  onclose: (() => void) | undefined;
  onerror: (() => void) | undefined;
  onopen: (() => void) | undefined;
  onretrying: ((e: { delayMillis: number }) => void) | undefined;

  addEventListener(type: EventName, listener: EventListener): void;
  close(): void;
}

export interface EventSourceInitDict {
  errorFilter: (err: { status: number; message: string }) => boolean;
  headers: { [key: string]: string | string[] };
  initialRetryDelayMillis: number;
  readTimeoutMillis: number;
  retryResetIntervalMillis: number;
}
