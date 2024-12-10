/* eslint-disable no-underscore-dangle */
import { EventListener, EventName, LDLogger } from '../../api';
import { DataSourceErrorKind } from '../../datasource';
import { DeleteObject, PayloadTransferred, PutObject, ServerIntentData } from './proto';

// Facade interface to contain only ability to add event listeners
export interface EventStream {
  addEventListener(type: EventName, listener: EventListener): void;
}

export interface JsonObjConverters {
  [kind: string]: (object: any) => any;
}

export interface Update {
  kind: string;
  key: string;
  version: number;
  object?: any;
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
    eventStream: EventStream,
    private readonly _jsonObjConverters: JsonObjConverters,
    private readonly _errorHandler?: (errorKind: DataSourceErrorKind, message: string) => void,
    private readonly _logger?: LDLogger,
  ) {
    this._attachHandler(eventStream, 'server-intent', this._processServerIntent);
    this._attachHandler(eventStream, 'put-object', this._processPutObject);
    this._attachHandler(eventStream, 'delete-object', this._processDeleteObject);
    this._attachHandler(eventStream, 'payload-transferred', this._processPayloadTransferred);
    this._attachHandler(eventStream, 'goodbye', this._processGoodbye);
    this._attachHandler(eventStream, 'error', this._processError);
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

  private _processObj(kind: string, jsonObj: any): any {
    return this._jsonObjConverters[kind]?.(jsonObj);
  }

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

  private _processPutObject = (event?: { data?: PutObject }) => {
    // if the following properties haven't been provided by now, we should ignore the event
    if (
      !this.tempId || // server intent hasn't been recieved yet.
      !event?.data?.kind ||
      !event?.data?.key ||
      !event?.data?.version ||
      !event?.data?.object
    ) {
      return;
    }

    const obj = this._processObj(event.data.kind, event.data.object);
    if (!obj) {
      // ignore unrecognized kinds
      return;
    }

    this.tempUpdates.push({
      kind: event.data.kind,
      key: event.data.key,
      version: event.data.version,
      object: obj,
      // intentionally omit deleted for this put
    });
  };

  private _processDeleteObject = (event?: { data?: DeleteObject }) => {
    // if the following properties haven't been provided by now, we should ignore the event
    if (!this.tempId || !event?.data?.kind || !event?.data?.key || !event?.data?.version) {
      return;
    }

    this.tempUpdates.push({
      kind: event.data.kind,
      key: event.data.key,
      version: event.data.version,
      // intentionally omit object for this delete
      deleted: true,
    });
  };

  private _processPayloadTransferred = (event?: { data?: PayloadTransferred }) => {
    // if the following properties haven't been provided by now, we should reset
    if (
      !this.tempId || // server intent hasn't been recieved yet.
      !event?.data?.state ||
      !event.data.version ||
      this.tempBasis === undefined
    ) {
      this._resetState(); // a reset is best defensive action since payload transferred terminates a payload
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

  private _processGoodbye = (event?: { data?: any }) => {
    this._logger?.info(
      `Goodbye was received from the LaunchDarkly connection with reason: ${event?.data?.reason}.`,
    );
    this._resetState();
  };

  private _processError = (event?: { data?: any }) => {
    this._logger?.info(
      `An issue was encountered receiving updates for payload ${this.tempId} with reason: ${event?.data?.reason}. Automatic retry will occur.`,
    );
    this._resetState();
  };

  private _resetState() {
    this.tempId = undefined;
    this.tempVersion = undefined;
    this.tempState = undefined;
    this.tempUpdates = [];
  }
}
