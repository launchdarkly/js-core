import * as http from 'http';
import * as url from 'url';

import {
  createEventSource,
  ErrorEvent,
  EventSourceInitDict,
  MessageEvent,
} from '@launchdarkly/eventsource';

export interface StreamOptions {
  streamUrl: string;
  callbackUrl: string;
  tag?: string;
  initialDelayMs?: number;
  readTimeoutMs?: number;
  lastEventId?: string;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

export interface StreamCommand {
  command: string;
  listen?: { type: string };
}

export interface StreamEntity {
  doCommand(params: StreamCommand): boolean;
  close(): void;
}

function log(tag: string | undefined, message: string): void {
  console.log(`[${tag}] INFO: ${message}`);
}

function logError(tag: string | undefined, message: string): void {
  console.log(`[${tag}] ERROR: ${message}`);
}

export function newStreamEntity(options: StreamOptions): StreamEntity {
  const listeningForType: Record<string, boolean> = {};
  const { tag } = options;
  let closed = false;
  let callbackCounter = 0;

  function sendMessage(message: unknown): void {
    if (closed) {
      return;
    }
    callbackCounter += 1;
    const callbackUrl = `${options.callbackUrl}/${callbackCounter}`;
    const reqParams = {
      ...url.parse(callbackUrl),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(reqParams, (res) => {
      if (!closed && res.statusCode !== undefined && res.statusCode >= 300) {
        logError(tag, `Callback to ${callbackUrl} returned HTTP error ${res.statusCode}`);
      }
      // Drain the response so its socket doesn't sit held open in the agent's pool for the rest
      // of the run; the body itself is never needed.
      res.resume();
    });
    req.on('error', (e) => {
      if (!closed) {
        logError(tag, `Callback to ${callbackUrl} failed: ${e}`);
      }
    });
    req.write(JSON.stringify(message));
    req.end();
  }

  log(tag, `Starting stream from ${options.streamUrl}`);

  // The code fills this object incrementally, so the type is Partial. The createEventSource
  // factory accepts a Partial.
  const eventSourceParams: Partial<EventSourceInitDict> = {};
  if (options.headers) {
    eventSourceParams.headers = { ...options.headers };
  }
  if (options.method) {
    eventSourceParams.method = options.method;
    eventSourceParams.body = options.body;
  }
  if (options.readTimeoutMs) {
    eventSourceParams.readTimeoutMillis = options.readTimeoutMs;
  }
  // A zero delay is a valid value, so the check must not use truthiness.
  if (options.initialDelayMs !== undefined) {
    eventSourceParams.initialRetryDelayMillis = options.initialDelayMs;
  }
  if (options.lastEventId) {
    eventSourceParams.headers = {
      ...eventSourceParams.headers,
      'Last-Event-ID': options.lastEventId,
    };
  }

  const onMessage = (event: MessageEvent): void => {
    // Internal lifecycle events (a connection error, a clean end) also reach the listeners
    // registered for their type. Only a server-sent frame carries a data property; the rest
    // must not be reported as events. The onerror slot reports the connection errors.
    if (!('data' in event)) {
      return;
    }
    log(tag, `Received message from stream (${event.type})`);
    sendMessage({
      kind: 'event',
      event: {
        type: event.type,
        data: event.data,
        id: event.lastEventId,
      },
    });
  };

  const sse = createEventSource(options.streamUrl, eventSourceParams);

  sse.onopen = () => {
    log(tag, 'Opened stream');
  };
  sse.addEventListener('closed', () => {
    log(tag, 'Closed stream');
  });
  sse.addEventListener('message', onMessage);
  sse.onerror = (error?: ErrorEvent) => {
    // A server-named "error" frame also reaches this slot, as a MessageEvent with a data
    // property. That frame is not a connection error. The listener registered through the
    // "listen" command reports it, so this slot must ignore it.
    if (error && 'data' in error) {
      return;
    }
    const errorString =
      error?.message ?? (error?.status ? `HTTP ${error.status}` : 'unknown error');
    log(tag, `Received error from stream: ${errorString}`);
    sendMessage({
      kind: 'error',
      error: errorString,
    });
  };

  return {
    doCommand(params: StreamCommand): boolean {
      switch (params.command) {
        case 'listen': {
          const eventType = params.listen?.type;
          // A listen command without a type is malformed. Report it as a bad command
          // instead of a silent success that registers nothing.
          if (!eventType) {
            return false;
          }
          // The default "message" type is registered once above; registering it again here
          // would deliver every message twice.
          if (eventType !== 'message' && !listeningForType[eventType]) {
            listeningForType[eventType] = true;
            sse.addEventListener(eventType, onMessage);
          }
          return true;
        }
        default:
          return false;
      }
    },
    close(): void {
      closed = true;
      sse.close();
      log(tag, 'Test ended');
    },
  };
}
