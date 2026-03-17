import { makeLogger } from '../logging/makeLogger.js';
import { CommandParams } from '../types/CommandParams.js';
import { CreateInstanceParams } from '../types/ConfigParams.js';

export interface IClientEntity {
  doCommand(params: CommandParams): Promise<unknown>;
  close(): void | Promise<void>;
}

export type CreateClientEntityFn = (options: CreateInstanceParams) => Promise<IClientEntity>;

export default class TestHarnessWebSocket {
  private _ws?: WebSocket;
  private readonly _entities: Record<string, IClientEntity> = {};
  private _clientCounter = 0;
  private _logger = makeLogger('TestHarnessWebSocket');
  private _intentionalClose = false;

  constructor(
    private readonly _url: string,
    private readonly _capabilities: string[],
    private readonly _createClient: CreateClientEntityFn,
    private readonly _onConnectionChange?: (connected: boolean) => void,
  ) {}

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
            const entity = await this._createClient(data.body);
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
