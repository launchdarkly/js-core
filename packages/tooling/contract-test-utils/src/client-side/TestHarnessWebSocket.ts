import { LDLogger } from '../types/compat.js';

import { makeLogger } from '../logging/makeLogger.js';

export interface ClientEntity {
  close: () => void;
  doCommand: (params: any) => Promise<any>;
}

export type CreateClientEntityFn = (options: any) => Promise<ClientEntity>;

export default class TestHarnessWebSocket {
  private _ws?: WebSocket;
  private readonly _entities: Record<string, ClientEntity> = {};
  private _clientCounter = 0;
  private _logger: LDLogger = makeLogger('TestHarnessWebSocket');
  private _capabilities: string[];
  private _createClientEntity: CreateClientEntityFn;
  private _intentionalClose = false;
  private _onConnectionChange?: (connected: boolean) => void;

  constructor(
    private readonly _url: string,
    capabilities: string[],
    createClientEntity: CreateClientEntityFn,
    onConnectionChange?: (connected: boolean) => void,
  ) {
    this._capabilities = capabilities;
    this._createClientEntity = createClientEntity;
    this._onConnectionChange = onConnectionChange;
  }

  connect() {
    this._intentionalClose = false;
    this._logger.info(`Connecting to web socket.`);
    this._ws = new WebSocket(this._url, ['v1']);
    this._ws.onopen = () => {
      this._logger.info('Connected to websocket.');
      this._onConnectionChange?.(true);
    };
    this._ws.onclose = () => {
      this._logger.info('Websocket closed. Attempting to reconnect in 1 second.');
      this._onConnectionChange?.(false);
      if (!this._intentionalClose) {
        setTimeout(() => {
          this.connect();
        }, 1000);
      }
    };
    this._ws.onerror = (err) => {
      this._logger.info(`error:`, err);
    };

    this._ws.onmessage = async (msg) => {
      this._logger.info('Test harness message', msg);
      const data = JSON.parse(msg.data as string);
      const resData: any = { reqId: data.reqId };
      switch (data.command) {
        case 'getCapabilities':
          resData.capabilities = this._capabilities;

          break;
        case 'createClient':
          try {
            resData.resourceUrl = `/clients/${this._clientCounter}`;
            resData.status = 201;
            const entity = await this._createClientEntity(data.body);
            this._entities[this._clientCounter] = entity;
            this._clientCounter += 1;
          } catch (e: any) {
            this._logger.error(`Failed to create client: ${e?.message ?? e}`);
            resData.status = 500;
          }
          break;
        case 'runCommand':
          if (Object.prototype.hasOwnProperty.call(this._entities, data.id)) {
            const entity = this._entities[data.id];
            try {
              const body = await entity.doCommand(data.body);
              resData.body = body;
              resData.status = body ? 200 : 204;
            } catch (e: any) {
              this._logger.error(`Command failed: ${e?.message ?? e}`);
              resData.status = 500;
            }
          } else {
            resData.status = 404;
            this._logger.warn(`Client did not exist: ${data.id}`);
          }

          break;
        case 'deleteClient':
          if (Object.prototype.hasOwnProperty.call(this._entities, data.id)) {
            const entity = this._entities[data.id];
            entity.close();
            delete this._entities[data.id];
          } else {
            resData.status = 404;
            this._logger.warn(`Could not delete client because it did not exist: ${data.id}`);
          }
          break;
        default:
          break;
      }

      this.send(resData);
    };
  }

  disconnect() {
    this._intentionalClose = true;
    this._ws?.close();
  }

  send(data: unknown) {
    this._ws?.send(JSON.stringify(data));
  }
}
