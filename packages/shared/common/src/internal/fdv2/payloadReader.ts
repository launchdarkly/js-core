/* eslint-disable no-underscore-dangle */
import { EventListener, EventName, LDLogger } from '../../api';
import { DataSourceErrorKind } from '../../datasource';
import { DataObject, PayloadTransferred, ServerIntentData } from './proto';

// Facade interface to contain only ability to add event listeners
export interface EventStream {
  addEventListener(type: EventName, listener: EventListener): void;
}

export interface JsonObjConverters {
  [kind: string]: (object: any) => any;
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

  constructor(
    eventSource: EventStream,
    private readonly _jsonObjConverters: JsonObjConverters,
    private readonly _errorHandler?: (errorKind: DataSourceErrorKind, message: string) => void,
    private readonly _logger?: LDLogger,
  ) {
    this._attachHandler(eventSource, 'server-intent', this._processServerIntent);
    this._attachHandler(eventSource, 'put-object', this._processPutObject);
    this._attachHandler(eventSource, 'delete-object', this._processDeleteObject);
    this._attachHandler(eventSource, 'payload-transferred', this._processPayloadTransferred);
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

  private _attachHandler(stream: EventStream, eventName: string, processor: (obj: any) => void) {
    stream.addEventListener(eventName, async (event?: { data?: string }) => {
      if (event?.data) {
        this._logger?.debug(`Received ${eventName} event`);

        try {
          processor(JSON.parse(event.data));
        } catch {
          this._logger?.error(`Stream received invalid data in "${eventName}" message`);
          this._logger?.debug(`Invalid JSON follows: ${event.data}`);
          this._errorHandler?.(
            DataSourceErrorKind.InvalidData,
            'Malformed JSON data in event stream',
          );
        }
      } else {
        this._errorHandler?.(DataSourceErrorKind.Unknown, 'Unexpected message from event stream');
      }
    });
  }

  private _convertJsonObj(jsonObj: any): any {
    return this._jsonObjConverters[jsonObj.kind]?.(jsonObj);
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

  private _processPutObject = (jsonObj: any) => {
    // if the following properties haven't been provided by now, we're in an invalid state
    if (!jsonObj.kind || !jsonObj.key || !jsonObj.version || !jsonObj.object) {
      this._resetState();
      return;
    }

    const obj = this._convertJsonObj(jsonObj);
    if (!obj) {
      // ignore unrecognized kinds
      return;
    }

    this.tempUpdates.push({
      kind: jsonObj.kind,
      key: jsonObj.key,
      version: jsonObj.version,
      object: obj,
      // intentionally omit deleted for this put
    });
  };

  private _processDeleteObject = (jsonObj: any) => {
    // if the following properties haven't been provided by now, we're in an invalid state
    if (!jsonObj.kind || !jsonObj.key || !jsonObj.version || !jsonObj.object) {
      this._resetState();
      return;
    }

    const obj = this._convertJsonObj(jsonObj);
    if (!obj) {
      // ignore unrecognized kinds
      return;
    }

    this.tempUpdates.push({
      kind: jsonObj.kind,
      key: jsonObj.key,
      version: jsonObj.version,
      object: obj,
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
