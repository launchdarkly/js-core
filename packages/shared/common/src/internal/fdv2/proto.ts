export interface Event {
  event: string;
  data: any;
}

export interface ServerIntentData {
  payloads: PayloadIntent[];
}

export type IntentCode = 'xfer-full' | 'xfer-changes' | 'none';

export interface PayloadIntent {
  id: string;
  target: number;
  intentCode: IntentCode;
  reason: string;
}

export interface PutObject {
  kind: string;
  key: string;
  version: number;
  object: any;
}

export interface DeleteObject {
  kind: string;
  key: string;
  version: number;
}

export interface PayloadTransferred {
  state: string;
  version: number;
}
