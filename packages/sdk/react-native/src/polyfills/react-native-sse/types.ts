export type BuiltInEventType = 'open' | 'message' | 'error' | 'close';
export type EventType<E extends string = never> = E | BuiltInEventType;

export interface MessageEvent {
  type: 'message';
  data: string | null;
  lastEventId: string | undefined;
  url: string;
}

export interface OpenEvent {
  type: 'open';
}

export interface CloseEvent {
  type: 'close';
}

export interface TimeoutEvent {
  type: 'timeout';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  xhrState: number;
  xhrStatus: number;
}

export interface CustomEvent<E extends string> {
  type: E;
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface ExceptionEvent {
  type: 'exception';
  message: string;
  error: Error;
}

export interface EventSourceOptions {
  method?: string;
  timeout?: number;
  timeoutBeforeConnection?: number;
  withCredentials?: boolean;
  headers?: Record<string, any>;
  body?: any;
  debug?: boolean;
  pollingInterval?: number;
}

type BuiltInEventMap = {
  message: MessageEvent;
  open: OpenEvent;
  close: CloseEvent;
  error: ErrorEvent | TimeoutEvent | ExceptionEvent;
};

export type EventSourceEvent<E extends T, T extends string = any> = E extends BuiltInEventType
  ? BuiltInEventMap[E]
  : CustomEvent<E>;
export type EventSourceListener<E extends string = never, T extends EventType<E> = EventType<E>> = (
  event: EventSourceEvent<T>,
) => void;
