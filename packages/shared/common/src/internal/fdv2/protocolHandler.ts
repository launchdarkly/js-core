import { LDLogger } from '../../api';
import {
  DeleteObject,
  PayloadIntent,
  PayloadTransferred,
  PutObject,
  ServerIntentData,
} from './proto';

/**
 * Defines object processing between deserialization and payload emission.
 * Can be used to provide object sanitization logic per kind.
 */
export interface ObjProcessors {
  [kind: string]: (object: any) => any;
}

export interface FDv2Event {
  event: string;
  data: any;
}

export interface FDv2EventsCollection {
  events: FDv2Event[];
}

export interface Update {
  kind: string;
  key: string;
  version: number;
  object?: any;
  deleted?: boolean;
}

export type PayloadType = 'full' | 'partial' | 'none';

/**
 * A collection of updates from the FDv2 services.
 *
 * - `full`: the updates represent the complete state and replace everything.
 * - `partial`: the updates are incremental changes to apply.
 * - `none`: no changes are needed; the SDK is up-to-date.
 */
export interface Payload {
  id: string;
  version: number;
  state?: string;
  type: PayloadType;
  updates: Update[];
}

export type PayloadListener = (payload: Payload) => void;

/**
 * - `inactive`: No server intent has been expressed (initial state).
 * - `changes`: Currently receiving incremental changes.
 * - `full`: Currently receiving a full transfer.
 */
export type ProtocolState = 'inactive' | 'changes' | 'full';

export type ProtocolErrorKind = 'UNKNOWN_EVENT' | 'MISSING_PAYLOAD' | 'PROTOCOL_ERROR';

/**
 * - `none`: No special action should be taken.
 * - `payload`: A changeset should be applied.
 * - `error`: An internal protocol error was encountered.
 * - `goodbye`: The server intends to disconnect.
 * - `serverError`: A server-side application error was encountered.
 */
export type ProtocolAction =
  | { type: 'none' }
  | { type: 'payload'; payload: Payload }
  | { type: 'error'; kind: ProtocolErrorKind; message: string }
  | { type: 'goodbye'; reason: string }
  | { type: 'serverError'; id?: string; reason: string };

const ACTION_NONE: ProtocolAction = { type: 'none' };

/**
 * Pure FDv2 protocol state machine. Processes a single event at a time and
 * returns an action describing what the caller should do. Contains no I/O
 * or callbacks.
 */
export interface ProtocolHandler {
  readonly state: ProtocolState;
  processEvent(event: FDv2Event): ProtocolAction;
  /** Resets the handler to inactive. Should be called when a connection is reset. */
  reset(): void;
}

export function createProtocolHandler(
  objProcessors: ObjProcessors,
  logger?: LDLogger,
): ProtocolHandler {
  let protocolState: ProtocolState = 'inactive';
  let tempId: string | undefined;
  let tempType: PayloadType = 'partial';
  let tempUpdates: Update[] = [];

  function processObj(kind: string, jsonObj: any): any {
    return objProcessors[kind]?.(jsonObj);
  }

  function resetAll(): void {
    protocolState = 'inactive';
    tempId = undefined;
    tempType = 'partial';
    tempUpdates = [];
  }

  function resetAfterEmission(): void {
    protocolState = 'changes';
    tempType = 'partial';
    tempUpdates = [];
  }

  function resetAfterError(): void {
    tempUpdates = [];
  }

  function processServerIntent(data: ServerIntentData): ProtocolAction {
    if (!data.payloads?.length) {
      return {
        type: 'error',
        kind: 'MISSING_PAYLOAD',
        message: 'No payload present in server-intent',
      };
    }

    // Per spec 3.4.2: SDK uses only the first payload.
    const payload = data.payloads[0];

    switch (payload?.intentCode) {
      case 'xfer-full':
        protocolState = 'full';
        tempUpdates = [];
        tempType = 'full';
        tempId = payload.id;
        return ACTION_NONE;
      case 'xfer-changes':
        protocolState = 'changes';
        tempUpdates = [];
        tempType = 'partial';
        tempId = payload.id;
        return ACTION_NONE;
      case 'none':
        protocolState = 'changes';
        tempUpdates = [];
        tempId = payload.id;
        return processIntentNone(payload);
      default:
        logger?.warn(`Unable to process intent code '${payload?.intentCode}'.`);
        return ACTION_NONE;
    }
  }

  function processIntentNone(intent: PayloadIntent): ProtocolAction {
    if (!intent.id || !intent.target) {
      return ACTION_NONE;
    }

    return {
      type: 'payload',
      payload: {
        id: intent.id,
        version: intent.target,
        type: 'none',
        updates: [],
      },
    };
  }

  function processPutObject(data: PutObject): ProtocolAction {
    if (
      protocolState === 'inactive' ||
      !tempId ||
      !data.kind ||
      !data.key ||
      !data.version ||
      !data.object
    ) {
      return ACTION_NONE;
    }

    const obj = processObj(data.kind, data.object);
    if (!obj) {
      logger?.warn(`Unable to process object for kind: '${data.kind}'`);
      return ACTION_NONE;
    }

    tempUpdates.push({
      kind: data.kind,
      key: data.key,
      version: data.version,
      object: obj,
    });
    return ACTION_NONE;
  }

  function processDeleteObject(data: DeleteObject): ProtocolAction {
    if (protocolState === 'inactive' || !tempId || !data.kind || !data.key || !data.version) {
      return ACTION_NONE;
    }

    tempUpdates.push({
      kind: data.kind,
      key: data.key,
      version: data.version,
      deleted: true,
    });
    return ACTION_NONE;
  }

  function processPayloadTransferred(data: PayloadTransferred): ProtocolAction {
    if (protocolState === 'inactive') {
      return {
        type: 'error',
        kind: 'PROTOCOL_ERROR',
        message:
          'A payload transferred has been received without an intent having been established.',
      };
    }

    if (!tempId || data.state === null || data.state === undefined || !data.version) {
      resetAll();
      return ACTION_NONE;
    }

    const result: ProtocolAction = {
      type: 'payload',
      payload: {
        id: tempId,
        version: data.version,
        state: data.state,
        type: tempType,
        updates: tempUpdates,
      },
    };

    resetAfterEmission();
    return result;
  }

  function processGoodbye(data: any): ProtocolAction {
    logger?.info(
      `Goodbye was received from the LaunchDarkly connection with reason: ${data.reason}.`,
    );
    return { type: 'goodbye', reason: data.reason };
  }

  function processError(data: any): ProtocolAction {
    logger?.info(
      `An issue was encountered receiving updates for payload ${tempId} with reason: ${data.reason}.`,
    );
    resetAfterError();
    return { type: 'serverError', id: data.payload_id, reason: data.reason };
  }

  return {
    get state(): ProtocolState {
      return protocolState;
    },

    processEvent(event: FDv2Event): ProtocolAction {
      switch (event.event) {
        case 'server-intent':
          return processServerIntent(event.data);
        case 'put-object':
          return processPutObject(event.data);
        case 'delete-object':
          return processDeleteObject(event.data);
        case 'payload-transferred':
          return processPayloadTransferred(event.data);
        case 'goodbye':
          return processGoodbye(event.data);
        case 'error':
          return processError(event.data);
        case 'heart-beat':
          return ACTION_NONE;
        default:
          return {
            type: 'error',
            kind: 'UNKNOWN_EVENT',
            message: `Received an unknown event of type '${event.event}'`,
          };
      }
    },

    reset(): void {
      resetAll();
    },
  };
}
