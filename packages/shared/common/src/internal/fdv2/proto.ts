export type EventType = 'server-intent' | 'put-object' | 'delete-object' | 'payload-transferred' | 'goodbye' | 'error'| 'heart-beat';
export type IntentCode = 'xfer-full' | 'xfer-changes' | 'none';
export type ObjectKind = 'flag' | 'segment';

export interface Event {
  event: EventType;
  data: ServerIntentData | PutObject | DeleteObject | PayloadTransferred | GoodbyeObject | ErrorObject;
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
