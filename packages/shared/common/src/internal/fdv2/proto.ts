export type EventType =
  | 'server-intent'
  | 'put-object'
  | 'delete-object'
  | 'payload-transferred'
  | 'goodbye'
  | 'error'
  | 'heart-beat';

export type IntentCode = 'xfer-full' | 'xfer-changes' | 'none';
export type ObjectKind = 'flag' | 'segment' | 'flag_eval';

export interface FDv2Event {
  /**
   * The event type could be one we know, or it could be any string.
   * This is for forward compatibility and to make it clear the protocol may send us types we don't recognize.
   */
  event: EventType | string;
  /**
   * Could be one of many known types, or an unknown type.
   * The unknown type is to handle forward compatibility.
   */
  data:
    | ServerIntentData
    | PutObject
    | DeleteObject
    | PayloadTransferred
    | GoodbyeObject
    | ErrorObject
    | unknown;
}

export interface FDv2EventsCollection {
  events: FDv2Event[];
}

export interface ServerIntentData {
  payloads: PayloadIntent[];
}

export interface PayloadIntent {
  id: string;
  target: number;
  intentCode: IntentCode;
  reason: string;
}

export interface PutObject {
  kind: ObjectKind;
  key: string;
  version: number;
  object: any;
}

export interface DeleteObject {
  kind: ObjectKind;
  key: string;
  version: number;
}

export interface GoodbyeObject {
  reason: string;
  silent: boolean;
  catastrophe: boolean;
}

export interface ErrorObject {
  payload_id: string;
  reason: string;
}

export interface PayloadTransferred {
  state: string;
  version: number;
  id?: string;
}
