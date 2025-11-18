/* eslint-disable no-underscore-dangle */
import { LDLogger } from '../../api';
import { DataSourceErrorKind } from '../../datasource';
import {
  DeleteObject,
  PayloadIntent,
  PayloadTransferred,
  PutObject,
  ServerIntentData,
} from './proto';

// Used to define object processing between deserialization and payload listener invocation.  This can be
// used provide object sanitization logic.
export interface ObjProcessors {
  [kind: string]: (object: any) => any;
}

// Represents a collection of events (one case where this is seen is in the polling response)
export interface FDv2EventsCollection {
  events: FDv2Event[];
}

// Represents a single event
export interface FDv2Event {
  event: string;
  data: any;
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
  state?: string;
  basis: boolean;
  updates: Update[];
}

export type PayloadListener = (payload: Payload) => void;

/**
 * A FDv2 PayloadProcessor can be used to parse payloads from a stream of FDv2 events. It will send payloads
 * to the PayloadListeners as the payloads are received. Invalid series of events may be dropped silently,
 * but the payload processor will continue to operate.
 */
export class PayloadProcessor {
  private _listeners: PayloadListener[] = [];

  private _tempId?: string = undefined;
  private _tempBasis: boolean = false;
  private _tempUpdates: Update[] = [];

  /**
   * Creates a PayloadProcessor
   *
   * @param _objProcessors defines object processors for each object kind.
   * @param _errorHandler that will be called with parsing errors as they are encountered
   * @param _logger for logging
   */
  constructor(
    private readonly _objProcessors: ObjProcessors,
    private readonly _errorHandler?: (errorKind: DataSourceErrorKind, message: string) => void,
    private readonly _logger?: LDLogger,
  ) {}

  addPayloadListener(listener: PayloadListener) {
    this._listeners.push(listener);
  }

  removePayloadListener(listener: PayloadListener) {
    const index = this._listeners.indexOf(listener, 0);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }

  /**
   * Gives the {@link PayloadProcessor} a series of events that it will statefully, incrementally process.
   * This may lead to listeners being invoked as necessary.
   * @param events to be processed (can be a single element)
   */
  processEvents(events: FDv2Event[]) {
    events.forEach((event) => {
      switch (event.event) {
        case 'server-intent': {
          this._processServerIntent(event.data);
          break;
        }
        case 'put-object': {
          this._processPutObject(event.data);
          break;
        }
        case 'delete-object': {
          this._processDeleteObject(event.data);
          break;
        }
        case 'payload-transferred': {
          this._processPayloadTransferred(event.data);
          break;
        }
        case 'goodbye': {
          this._processGoodbye(event.data);
          break;
        }
        case 'error': {
          this._processError(event.data);
          break;
        }
        default: {
          // no-op, unrecognized
        }
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

    switch (payload?.intentCode) {
      case 'xfer-full':
        this._tempBasis = true;
        break;
      case 'xfer-changes':
        this._tempBasis = false;
        break;
      case 'none':
        this._tempBasis = false;
        this._processIntentNone(payload);
        break;
      default:
        // unrecognized intent code, return
        this._logger?.warn(`Unable to process intent code '${payload?.intentCode}'.`);
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

  private _processIntentNone = (intent: PayloadIntent) => {
    // if the following properties aren't present ignore the event
    if (!intent.id || !intent.target) {
      return;
    }

    const payload: Payload = {
      id: intent.id,
      version: intent.target,
      basis: false, // intent none is always not a basis
      updates: [], // payload with no updates to hide the intent none concept from the consumer
      // note: state is absent here as that only appears in payload transferred events
    };

    this._listeners.forEach((it) => it(payload));
    this._resetAfterEmission();
  };

  private _processPayloadTransferred = (data: PayloadTransferred) => {
    // if the following properties haven't been provided by now, we should reset
    if (
      // server intent hasn't been received yet.
      !this._tempId ||
      // selector can be an empty string if we are using a file data initilizer
      data.state === null ||
      data.state === undefined ||
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
