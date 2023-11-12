export type BuiltInEventType = 'open' | 'message' | 'error' | 'close';
export type EventType<E extends string = never> = E | BuiltInEventType;

export interface EventSourceOptions {
  body?: any;
  debug?: boolean;
  headers?: Record<string, any>;
  method?: string;
  pollingInterval?: number;
  timeout?: number;
  timeoutBeforeConnection?: number;
  withCredentials?: boolean;
}
