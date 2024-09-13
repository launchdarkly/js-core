import { LDLogger } from '@launchdarkly/js-client-sdk';

import { ClientEntity, newSdkClientEntity } from './ClientEntity';
import { makeLogger } from './makeLogger';

export default class TestHarnessWebSocket {
  private ws?: WebSocket;
  private readonly entities: Record<string, ClientEntity> = {};
  private clientCounter = 0;
  private logger: LDLogger = makeLogger('TestHarnessWebSocket');

  constructor(private readonly url: string) {}

  connect() {
    this.logger.info(`Connecting to web socket.`);
    this.ws = new WebSocket(this.url, ['v1']);
    this.ws.onopen = () => {
      this.logger.info('Connected to websocket.');
    };
    this.ws.onclose = () => {
      this.logger.info('Websocket closed. Attempting to reconnect in 1 second.');
      setTimeout(() => {
        this.connect();
      }, 1000);
    };
    this.ws.onerror = (err) => {
      this.logger.info(`error:`, err);
    };

    this.ws.onmessage = async (msg) => {
      this.logger.info('Test harness message', msg);
      const data = JSON.parse(msg.data);
      const resData: any = { reqId: data.reqId };
      switch (data.command) {
        case 'getCapabilities':
          resData.capabilities = [
            'client-side',
            'service-endpoints',
            'tags',
            'user-type',
            'inline-context',
            'anonymous-redaction',
          ];

          break;
        case 'createClient':
          {
            resData.resourceUrl = `/clients/${this.clientCounter}`;
            resData.status = 201;
            const entity = await newSdkClientEntity(data.body);
            this.entities[this.clientCounter] = entity;
            this.clientCounter += 1;
          }
          break;
        case 'runCommand':
          if (Object.prototype.hasOwnProperty.call(this.entities, data.id)) {
            const entity = this.entities[data.id];
            const body = await entity.doCommand(data.body);
            resData.body = body;
            resData.status = body ? 200 : 204;
          } else {
            resData.status = 404;
            this.logger.warn(`Client did not exist: ${data.id}`);
          }

          break;
        case 'deleteClient':
          if (Object.prototype.hasOwnProperty.call(this.entities, data.id)) {
            const entity = this.entities[data.id];
            entity.close();
            delete this.entities[data.id];
          } else {
            resData.status = 404;
            this.logger.warn(`Could not delete client because it did not exist: ${data.id}`);
          }
          break;
        default:
          break;
      }

      this.send(resData);
    };
  }

  disconnect() {
    this.ws?.close();
  }

  send(data: unknown) {
    this.ws?.send(JSON.stringify(data));
  }
}
