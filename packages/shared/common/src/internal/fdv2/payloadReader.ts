import { EventListener, EventName } from '../../api';
import { DataObject, PayloadTransferred, ServerIntentData } from './proto';

// Facade interface to contain only ability to add event listeners
export interface EventStream {
  addEventListener(type: EventName, listener: EventListener): void;
}

export interface Update extends DataObject {
  deleted?: boolean;
}

export interface Payload {
  id: string;
  version: number;
  state: string;
  basis: boolean;
  updates: Update[];
}

export type PayloadListener = (payload: Payload) => void;

export class PayloadReader {
  listeners: PayloadListener[] = [];

  tempId?: string = undefined;
  tempVersion?: number = undefined;
  tempState?: string = undefined;
  tempBasis?: boolean = undefined;
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
    // clear state in prep for handling data
    this._resetState();

    // if there's no payloads, return
    if ((event?.data?.payloads.length ?? 0) <= 0) {
      return;
    }
    // at the time of writing this, it was agreed upon that SDKs could assume exactly 1 element in this list.  In the future, a negotiation of protocol version will be required to remove this assumption.
    const payload = event?.data?.payloads[0];

    switch (payload?.intentCode) {
      case 'xfer-full':
        this.tempBasis = true;
        break;
      case 'xfer-changes':
      case 'none':
        this.tempBasis = false;
        break;
      default:
        // unrecognized intent code, return
        return;
    }

    this.tempId = payload?.id;
  };

  private _processPutObject = (event?: { data?: DataObject }) => {
    // if the following properties haven't been provided by now, we're in an invalid state
    if (!event?.data?.kind || !event.data.key || !event.data.version || !event.data.object) {
      this._resetState();
      return;
    }

    this.tempUpdates.push({
      kind: event.data.kind,
      key: event.data.key,
      object: event.data.object,
      version: event.data.version,
      // intentionally omit deleted for this put
    });
  };

  // TODO: consider merging put and delete and having param for delete logic
  private _processDeleteObject = (event?: { data?: DataObject }) => {
    // if the following properties haven't been provided by now, we're in an invalid state
    if (!event?.data?.kind || !event.data.key || !event.data.version || !event.data.object) {
      this._resetState();
      return;
    }

    this.tempUpdates.push({
      kind: event.data.kind,
      key: event.data.key,
      object: event.data.object,
      version: event.data.version,
      deleted: true,
    });
  };

  private _processPayloadTransferred = (event?: { data?: PayloadTransferred }) => {
    // if the following properties haven't been provided by now, we're in an invalid state
    if (!event?.data?.state || !event.data.version || !this.tempBasis) {
      this._resetState();
      return;
    }

    const payload: Payload = {
      id: this.tempId!,
      version: event.data.version,
      state: event.data.state,
      basis: this.tempBasis,
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
