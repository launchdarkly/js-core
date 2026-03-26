import { makeLogger } from '../logging/makeLogger.js';
import { CommandParams } from '../types/CommandParams.js';
import { LDLogger } from '../types/compat.js';
import { CreateInstanceParams } from '../types/ConfigParams.js';
import { Capability } from './capabilities.js';

export interface IClientEntity {
  doCommand(params: CommandParams): Promise<unknown>;
  close(): void;
}

type CreateClientFn = (id: string, params: CreateInstanceParams) => Promise<IClientEntity>;
type DeleteClientFn = (id: string) => void;
type GetClientFn = (id: string) => IClientEntity | undefined;
type ConnectionChangeFn = (connected: boolean) => void;

class TestHarnessWebSocket {
  private _ws?: WebSocket;
  private _logger: LDLogger;
  private _intentionalClose = false;

  constructor(
    private readonly _url: string,
    private readonly _capabilities: Capability[],
    private readonly _createClient: CreateClientFn,
    private readonly _deleteClient: DeleteClientFn,
    private readonly _getClient: GetClientFn,
    private readonly _onConnectionChange?: ConnectionChangeFn,
  ) {
    this._logger = makeLogger('TestHarnessWebSocket');
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
      const data = JSON.parse(typeof msg.data === 'string' ? msg.data : String(msg.data));
      const resData: any = { reqId: data.reqId };

      switch (data.command) {
        case 'getCapabilities':
          resData.capabilities = [...this._capabilities];
          break;

        case 'createClient': {
          const id = String(this._clientCounter);
          this._clientCounter += 1;
          try {
            await this._createClient(id, data.body);
            resData.resourceUrl = `/clients/${id}`;
            resData.status = 201;
          } catch (e: any) {
            resData.status = 500;
            resData.error = e?.message ?? String(e);
          }
          break;
        }

        case 'runCommand': {
          const entity = this._getClient(data.id);
          if (entity) {
            try {
              const body = await entity.doCommand(data.body);
              resData.body = body;
              resData.status = body ? 200 : 204;
            } catch (e: any) {
              if (e?.message === 'unsupported command') {
                resData.status = 400;
                resData.error = e.message;
              } else {
                resData.status = 500;
                resData.error = e?.message ?? String(e);
              }
            }
          } else {
            resData.status = 404;
            this._logger.warn(`Client did not exist: ${data.id}`);
          }
          break;
        }

        case 'deleteClient':
          this._deleteClient(data.id);
          resData.status = 200;
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

  private _clientCounter = 0;
}

/**
 * Creates a TestHarnessWebSocket instance that is compatible with the
 * @launchdarkly/js-contract-test-utils/adapter tool.
 */
export class TestHarnessWebSocketBuilder {
  private _url = 'ws://localhost:8001';
  private _capabilities: Capability[] = [];
  private _createClient?: CreateClientFn;
  private _deleteClient?: DeleteClientFn;
  private _getClient?: GetClientFn;
  private _connectionChange?: ConnectionChangeFn;

  setUrl(url: string): this {
    this._url = url;
    return this;
  }

  setCapabilities(capabilities: Capability[]): this {
    this._capabilities = capabilities;
    return this;
  }

  onCreateClient(fn: CreateClientFn): this {
    this._createClient = fn;
    return this;
  }

  onDeleteClient(fn: DeleteClientFn): this {
    this._deleteClient = fn;
    return this;
  }

  onGetClient(fn: GetClientFn): this {
    this._getClient = fn;
    return this;
  }

  onConnectionChange(fn: ConnectionChangeFn): this {
    this._connectionChange = fn;
    return this;
  }

  build(): TestHarnessWebSocket {
    if (!this._createClient) {
      throw new Error('onCreateClient is required');
    }
    if (!this._deleteClient) {
      throw new Error('onDeleteClient is required');
    }
    if (!this._getClient) {
      throw new Error('onGetClient is required');
    }

    return new TestHarnessWebSocket(
      this._url,
      this._capabilities,
      this._createClient,
      this._deleteClient,
      this._getClient,
      this._connectionChange,
    );
  }
}
