/* eslint-disable no-underscore-dangle */
import { EventListener, EventName, LDLogger } from '../../api';
import { DataSourceErrorKind } from '../../datasource';
import { DeleteObject, PayloadTransferred, PutObject, ServerIntentData } from './proto';

// Facade interface to contain only ability to add event listeners
export interface EventStream {
  addEventListener(type: EventName, listener: EventListener): void;
}

// Used to define object processing between deserialization and payload listener invocation.  This can be
// used provide object sanitization logic.
export interface ObjProcessors {
  [kind: string]: (object: any) => any;
}

// Represents information for one keyed object.
export interface Update {
  kind: string;
  key: string;
  version: number;
  object?: any;
  deleted?: boolean;
}

// Represents a collection of updates from the FDv2 services. If basis is true, the set of updates represents the
// complete state of the payload.
export interface Payload {
  id: string;
  version: number;
  state: string;
  basis: boolean;
  updates: Update[];
}

export type PayloadListener = (payload: Payload) => void;

/**
 * A FDv2 PayloadReader can be used to parse payloads from a stream of FDv2 events. It will send payloads
 * to the PayloadListeners as the payloads are received. Invalid series of events may be dropped silently,
 * but the payload reader will continue to operate.
 */
export class PayloadReader {
  private _listeners: PayloadListener[] = [];

  private _tempId?: string = undefined;
  private _tempBasis: boolean = false;
  private _tempUpdates: Update[] = [];

  /**
   * Creates a PayloadReader
   *
   * @param eventStream event stream of FDv2 events
   * @param _objProcessors defines object processors for each object kind.
   * @param _errorHandler that will be called with errors as they are encountered
   * @param _logger for logging
   */
  constructor(
    eventStream: EventStream,
    private readonly _objProcessors: ObjProcessors,
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
    this._listeners.push(listener);
  }

  removePayloadListener(listener: PayloadListener) {
    const index = this._listeners.indexOf(listener, 0);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  private _attachHandler(stream: EventStream, eventName: string, processor: (obj: any) => void) {
    stream.addEventListener(eventName, async (event?: { data?: string }) => {
      if (event?.data) {
        this._logger?.debug(`Received ${eventName} event.  Data is ${event.data}`);
        try {
          processor(JSON.parse(event.data));
        } catch {
          this._logger?.error(
            `Stream received data that was unable to be processed in "${eventName}" message`,
          );
          this._logger?.debug(`Data follows: ${event.data}`);
          this._errorHandler?.(DataSourceErrorKind.InvalidData, 'Malformed data in event stream');
        }
      } else {
        this._errorHandler?.(DataSourceErrorKind.Unknown, 'Unexpected message from event stream');
      }
    });
  }

  private _processObj(kind: string, jsonObj: any): any {
    return this._objProcessors[kind]?.(jsonObj);
  }

  private _processServerIntent = (data: ServerIntentData) => {
    // clear state in prep for handling data
    this._resetAll();

    // if there's no payloads, return
    if (!data.payloads.length) {
      return;
    }
    // at the time of writing this, it was agreed upon that SDKs could assume exactly 1 element in this list.  In the future, a negotiation of protocol version will be required to remove this assumption.
    const payload = data.payloads[0];

    switch (payload?.code) {
      case 'xfer-full':
        this._tempBasis = true;
        break;
      case 'xfer-changes':
      case 'none':
        this._tempBasis = false;
        break;
      default:
        // unrecognized intent code, return
        return;
    }

    this._tempId = payload?.id;
  };

  private _processPutObject = (data: PutObject) => {
    // if the following properties haven't been provided by now, we should ignore the event
    if (
      !this._tempId || // server intent hasn't been received yet.
      !data.kind ||
      !data.key ||
      !data.version ||
      !data.object
    ) {
      return;
    }

    const obj = this._processObj(data.kind, data.object);
    if (!obj) {
      this._logger?.warn(`Unable to process object for kind: '${data.kind}'`);
      // ignore unrecognized kinds
      return;
    }

    this._tempUpdates.push({
      kind: data.kind,
      key: data.key,
      version: data.version,
      object: obj,
      // intentionally omit deleted for this put
    });
  };

  private _processDeleteObject = (data: DeleteObject) => {
    // if the following properties haven't been provided by now, we should ignore the event
    if (!this._tempId || !data.kind || !data.key || !data.version) {
      return;
    }

    this._tempUpdates.push({
      kind: data.kind,
      key: data.key,
      version: data.version,
      // intentionally omit object for this delete
      deleted: true,
    });
  };

  private _processPayloadTransferred = (data: PayloadTransferred) => {
    // if the following properties haven't been provided by now, we should reset
    if (
      !this._tempId || // server intent hasn't been recieved yet.
      !data.state ||
      !data.version
    ) {
      this._resetAll(); // a reset is best defensive action since payload transferred terminates a payload
      return;
    }

    const payload: Payload = {
      id: this._tempId!,
      version: data.version,
      state: data.state,
      basis: this._tempBasis,
      updates: this._tempUpdates,
    };

    this._listeners.forEach((it) => it(payload));
    this._resetAfterEmission();
  };

  private _processGoodbye = (data: any) => {
    this._logger?.info(
      `Goodbye was received from the LaunchDarkly connection with reason: ${data.reason}.`,
    );
    this._resetAll();
  };

  private _processError = (data: any) => {
    this._logger?.info(
      `An issue was encountered receiving updates for payload ${this._tempId} with reason: ${data.reason}.`,
    );
    this._resetAfterError();
  };

  private _resetAfterEmission() {
    this._tempBasis = false;
    this._tempUpdates = [];
  }

  private _resetAfterError() {
    this._tempUpdates = [];
  }

  private _resetAll() {
    this._tempId = undefined;
    this._tempBasis = false;
    this._tempUpdates = [];
  }
}
