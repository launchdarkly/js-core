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

export interface DataObject {
  kind: string;
  key: string;
  version: number;
  object: any;
}

export interface PayloadTransferred {
  state: string;
  version: number;
}
