import { EventListener, EventName } from '../../api';
import { DataObject, PayloadTransferred, ServerIntentData } from './proto';

// Facade interface to contain only ability to add event listeners
export interface EventStream {
  addEventListener(type: EventName, listener: EventListener): void;
}

export interface ItemDescriptor {
  item: any;
  version: number;
  deleted?: boolean;
}

export interface Update {
  kind: string;
  key: string;
  item: ItemDescriptor;
}

export interface Payload {
  id: string;
  version: number;
  state: string;
  updates: Update[];
}

export type PayloadListener = (payload: Payload) => void;

export class PayloadReader {
  listeners: PayloadListener[] = [];

  tempId?: string = undefined;
  tempVersion?: number = undefined;
  tempState?: string = undefined;
  tempUpdates: Update[] = [];

  constructor(eventSource: EventStream, listeners: PayloadListener[]) {
    this.listeners = listeners.concat(listeners);

    eventSource.addEventListener('server-intent', this._processServerIntent);
    eventSource.addEventListener('put-object', this._processPutObject);
    eventSource.addEventListener('delete-object', this._processDeleteObject);
    eventSource.addEventListener('payload-transferred', this._processPayloadTransferred);
  }

  addPayloadListener(listener: PayloadListener) {
    this.listeners.push(listener);
  }

  removePayloadListener(listener: PayloadListener) {
    const index = this.listeners.indexOf(listener, 0);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // TODO: add valid state/reset handling if an invalid message is received part way through processing and to avoid starting prcessing put/deletes before server intent is received
  private _processServerIntent = (event?: { data?: ServerIntentData }) => {
    // TODO: length check and error log if 0 payloads

    // TODO: if intent is none, ignore and return

    // TODO: logic for ignoring invalid message formats?  Probably not worth validating except when finally emitting the payload

    // at the time of writing this, it was agreed upon that SDKs could assume exactly 1 element in this list
    const payload = event?.data?.payloads[0];
    this.tempId = payload?.id;
  };

  private _processPutObject = (event?: { data?: DataObject }) => {
    if (event?.data?.kind && event.data.key && event.data.version && event.data.object) {
      if (!event?.data?.kind || !event.data.key || !event.data.version || !event.data.object) {
        this._resetState();
        return;
      }

      const item: ItemDescriptor = {
        item: event.data.object,
        version: event.data.version,
        // intentionally omit deleted for this put
      };

      this.tempUpdates.push({
        kind: event.data.kind,
        key: event.data.key,
        item,
      });
    }
  };

  // TODO: consider merging put and delete and having param for delete logic
  private _processDeleteObject = (event?: { data?: DataObject }) => {
    if (!event?.data?.kind || !event.data.key || !event.data.version || !event.data.object) {
      this._resetState();
      return;
    }

    const item: ItemDescriptor = {
      item: event.data.object,
      version: event.data.version,
      deleted: true,
    };

    this.tempUpdates.push({
      kind: event.data.kind,
      key: event.data.key,
      item,
    });
  };

  private _processPayloadTransferred = (event?: { data?: PayloadTransferred }) => {
    if (!event?.data?.state || !event.data.version) {
      this._resetState();
      return;
    }

    const payload: Payload = {
      id: this.tempId!,
      version: event.data.version,
      state: event.data.state,
      updates: this.tempUpdates,
    };

    this.listeners.forEach((it) => it(payload));
    this._resetState();
  };

  private _resetState() {
    this.tempId = undefined;
    this.tempVersion = undefined;
    this.tempState = undefined;
    this.tempUpdates = [];
  }
}
