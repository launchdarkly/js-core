import { LDLogger } from '@launchdarkly/react-sdk';

import { CommandHandler } from './ClientEntity';
import { CreateInstanceParams } from './ConfigParams';
import { makeLogger } from './makeLogger';

export default class TestHarnessWebSocket {
  private _ws?: WebSocket;
  private _logger: LDLogger = makeLogger('TestHarnessWebSocket');

  constructor(
    private readonly _url: string,
    private readonly _commandHandlers: Map<string, CommandHandler>,
    private readonly _onCreateClient: (params: CreateInstanceParams) => Promise<string>,
    private readonly _onDeleteClient: (id: string) => void,
  ) {}

  connect() {
    this._logger.info(`Connecting to web socket.`);
    this._ws = new WebSocket(this._url, ['v1']);
    this._ws.onopen = () => {
      this._logger.info('Connected to websocket.');
    };
    this._ws.onclose = () => {
      this._logger.info('Websocket closed. Attempting to reconnect in 1 second.');
      setTimeout(() => {
        this.connect();
      }, 1000);
    };
    this._ws.onerror = (err) => {
      this._logger.info(`error:`, err);
    };

    this._ws.onmessage = async (msg) => {
      this._logger.info('Test harness message', msg);
      const data = JSON.parse(msg.data);
      const resData: any = { reqId: data.reqId };

      switch (data.command) {
        case 'getCapabilities':
          resData.capabilities = [
            'client-side',
            'service-endpoints',
            'tags',
            'user-type',
            'inline-context-all',
            'anonymous-redaction',
            'strongly-typed',
            'client-prereq-events',
            'client-per-context-summaries',
            'track-hooks',
          ];
          break;

        case 'createClient': {
          try {
            const id = await this._onCreateClient(data.body);
            resData.resourceUrl = `/clients/${id}`;
            resData.status = 201;
          } catch (e: any) {
            resData.status = 500;
            resData.error = e?.message ?? String(e);
          }
          break;
        }

        case 'runCommand': {
          const handler = this._commandHandlers.get(data.id);
          if (handler) {
            try {
              const body = await handler(data.body);
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
          this._onDeleteClient(data.id);
          resData.status = 200;
          break;

        default:
          break;
      }

      this.send(resData);
    };
  }

  disconnect() {
    this._ws?.close();
  }

  send(data: unknown) {
    this._ws?.send(JSON.stringify(data));
  }
}
