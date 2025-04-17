import { LDLogger } from '@launchdarkly/js-client-sdk';

import { ClientEntity, newSdkClientEntity } from './ClientEntity';
import { makeLogger } from './makeLogger';

export default class TestHarnessWebSocket {
  private _ws?: WebSocket;
  private readonly _entities: Record<string, ClientEntity> = {};
  private _clientCounter = 0;
  private _logger: LDLogger = makeLogger('TestHarnessWebSocket');

  constructor(private readonly _url: string) {}

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
          ];

          break;
        case 'createClient':
          {
            resData.resourceUrl = `/clients/${this._clientCounter}`;
            resData.status = 201;
            const entity = await newSdkClientEntity(data.body);
            this._entities[this._clientCounter] = entity;
            this._clientCounter += 1;
          }
          break;
        case 'runCommand':
          if (Object.prototype.hasOwnProperty.call(this._entities, data.id)) {
            const entity = this._entities[data.id];
            const body = await entity.doCommand(data.body);
            resData.body = body;
            resData.status = body ? 200 : 204;
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
    this._ws?.close();
  }

  send(data: unknown) {
    this._ws?.send(JSON.stringify(data));
  }
}
