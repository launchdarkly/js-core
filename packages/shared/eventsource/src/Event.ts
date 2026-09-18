/** The raw properties of an `error` or `end` event. */
export type RawErrorPayload = {
  status?: number;
  headers?: Record<string, string>;
  message?: string;
};

/**
 * The payload of the `error` and `end` events.
 *
 * @remark
 * This shape mirrors the platform's `HttpErrorResponse`. It is the argument of `onerror` and the
 * argument of the SDK's `errorFilter` callback. For this reason, it must stay interchangeable with
 * `HttpErrorResponse` in both directions.
 */
export interface ErrorEvent {
  readonly type?: string;
  readonly message: string;
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

/**
 * The payload of the `open` event.
 */
export interface OpenEvent {
  readonly type?: string;
  readonly headers?: Record<string, string | string[] | undefined>;
}

/**
 * The payload of the `retrying` event.
 */
export interface RetryingEvent {
  readonly type?: string;
  readonly delayMillis: number;
}

/**
 * The payload of the `closed` event.
 */
export interface ClosedEvent {
  readonly type?: string;
}

/**
 * The payload of the `message` event, and of each event for a named SSE `event:` type.
 */
export interface MessageEvent {
  readonly type: string;
  readonly data: string;
  readonly lastEventId: string;
  readonly origin: string;
}

/**
 * The payload type for each event type that this library dispatches, keyed by event type name.
 * The typed `addEventListener`/`removeEventListener` overloads on `EventSource` use this map.
 */
export interface EventSourceEventMap {
  closed: ClosedEvent;
  end: ErrorEvent;
  error: ErrorEvent | MessageEvent;
  message: MessageEvent;
  open: OpenEvent;
  retrying: RetryingEvent;
}

/**
 * W3C Event factory, and W3C MessageEvent factory for a server-named SSE frame.
 *
 * For a literal event type from {@link EventSourceEventMap}, the return type matches that map.
 * For a non-literal string type, the return type is {@link MessageEvent}: a server-chosen SSE
 * `event:` name always carries a `MessageEvent` payload.
 *
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 * @see http://www.w3.org/TR/webmessaging/#event-definitions
 */
export function makeEvent<K extends keyof EventSourceEventMap>(
  type: K,
  init?: Omit<EventSourceEventMap[K], 'type'>,
): EventSourceEventMap[K];
export function makeEvent(type: string, init: Omit<MessageEvent, 'type'>): MessageEvent;
export function makeEvent(
  type: string,
  optionalProperties?: Record<string, unknown>,
): { type: string } {
  const event: Record<string, unknown> = {};
  Object.defineProperty(event, 'type', { writable: false, value: type, enumerable: true });
  if (optionalProperties) {
    Object.keys(optionalProperties).forEach((f) => {
      Object.defineProperty(event, f, {
        writable: false,
        value: optionalProperties[f],
        enumerable: true,
      });
    });
  }
  return event as { type: string };
}
