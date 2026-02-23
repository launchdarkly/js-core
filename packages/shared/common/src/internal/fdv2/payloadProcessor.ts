import { LDLogger } from '../../api';
import { DataSourceErrorKind } from '../../datasource';
import {
  createProtocolHandler,
  FDv2Event,
  ObjProcessors,
  PayloadListener,
  ProtocolErrorKind,
} from './protocolHandler';

/**
 * Errors that indicate a problem with the data or protocol flow and should
 * be reported to the error handler. Informational errors like UNKNOWN_EVENT
 * are intentionally excluded to preserve forward compatibility — older SDKs
 * should silently ignore new event types added to the protocol.
 */
function isActionableError(kind: ProtocolErrorKind): boolean {
  return kind === 'MISSING_PAYLOAD' || kind === 'PROTOCOL_ERROR';
}

/**
 * Parses payloads from a stream of FDv2 events by delegating to a protocol handler.
 * Sends completed payloads to registered listeners.
 * Invalid event sequences may be dropped silently, but the processor will continue to operate.
 */
export class PayloadProcessor {
  private _listeners: PayloadListener[] = [];
  private readonly _handler;

  constructor(
    objProcessors: ObjProcessors,
    private readonly _errorHandler?: (errorKind: DataSourceErrorKind, message: string) => void,
    private readonly _logger?: LDLogger,
  ) {
    this._handler = createProtocolHandler(objProcessors, _logger);
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

  processEvents(events: FDv2Event[]) {
    events.forEach((event) => {
      const action = this._handler.processEvent(event);
      switch (action.type) {
        case 'payload':
          this._listeners.forEach((it) => it(action.payload));
          break;
        case 'error':
          if (isActionableError(action.kind)) {
            this._errorHandler?.(DataSourceErrorKind.InvalidData, action.message);
          } else {
            this._logger?.warn(action.message);
          }
          break;
        default:
          break;
      }
    });
  }
}
