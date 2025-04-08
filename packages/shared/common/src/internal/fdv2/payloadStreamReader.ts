/* eslint-disable no-underscore-dangle */
import { EventListener, EventName, LDLogger } from '../../api';
import { DataSourceErrorKind } from '../../datasource';
import { ObjProcessors, PayloadListener, PayloadProcessor } from './payloadProcessor';

// Facade interface to contain only ability to add event listeners
export interface EventStream {
  addEventListener(type: EventName, listener: EventListener): void;
}

/**
 * A FDv2 PayloadStreamReader can be used to parse payloads from a stream of FDv2 events.  See {@link PayloadProcessor}
 * for more details.
 */
export class PayloadStreamReader {
  private _payloadProcessor: PayloadProcessor;

  /**
   * Creates a PayloadStreamReader
   *
   * @param eventStream event stream of FDv2 events
   * @param _objProcessors defines object processors for each object kind.
   * @param _errorHandler that will be called with parsing errors as they are encountered
   * @param _logger for logging
   */
  constructor(
    eventStream: EventStream,
    _objProcessors: ObjProcessors,
    private readonly _errorHandler?: (errorKind: DataSourceErrorKind, message: string) => void,
    private readonly _logger?: LDLogger,
  ) {
    this._attachHandler(eventStream, 'server-intent');
    this._attachHandler(eventStream, 'put-object');
    this._attachHandler(eventStream, 'delete-object');
    this._attachHandler(eventStream, 'payload-transferred');
    this._attachHandler(eventStream, 'goodbye');
    this._attachHandler(eventStream, 'error');
    this._payloadProcessor = new PayloadProcessor(_objProcessors, _errorHandler, _logger);
  }

  addPayloadListener(listener: PayloadListener) {
    this._payloadProcessor.addPayloadListener(listener);
  }

  removePayloadListener(listener: PayloadListener) {
    this._payloadProcessor.removePayloadListener(listener);
  }

  private _attachHandler(stream: EventStream, eventName: string) {
    stream.addEventListener(eventName, async (event?: { data?: string }) => {
      if (event?.data) {
        this._logger?.debug(`Received ${eventName} event.  Data is ${event.data}`);
        try {
          this._payloadProcessor.processEvents([
            { event: eventName, data: JSON.parse(event.data) },
          ]);
        } catch {
          this._logger?.error(
            `Stream received data that was unable to be processed in "${eventName}" message`,
          );
          this._logger?.debug(`Data follows: ${event.data}`);
          this._errorHandler?.(DataSourceErrorKind.InvalidData, 'Malformed data in EventStream.');
        }
      } else {
        this._errorHandler?.(DataSourceErrorKind.Unknown, 'Event from EventStream missing data.');
      }
    });
  }
}
