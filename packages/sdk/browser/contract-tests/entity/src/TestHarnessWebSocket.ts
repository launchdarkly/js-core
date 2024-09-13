import { ClientEntity, newSdkClientEntity } from './ClientEntity';

export default class TestHarnessWebSocket {
  private ws: WebSocket;
  private readonly entities: Record<string, ClientEntity> = {};
  private clientCounter = 0;

  constructor(private readonly url: string) {
    console.log(`Connecting to web socket.`);
    this.ws = new WebSocket(this.url, ['v1']);
    this.ws.onopen = () => {
      console.log('Connected to websocket.');
    };
    this.ws.onclose = () => {
      console.log('Websocket closed');
    };
    this.ws.onerror = (err) => {
      console.log(`error:`, err);
    };

    this.ws.onmessage = async (msg) => {
      const data = JSON.parse(msg.data);
      const resData: any = { reqId: data.reqId };
      switch (data.command) {
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
          }

          break;
        case 'deleteClient':
          if (Object.prototype.hasOwnProperty.call(this.entities, data.id)) {
            const entity = this.entities[data.id];
            entity.close();
            delete this.entities[data.id];
          } else {
            resData.status = 404;
          }
          break;
        default:
          break;
      }

      this.send(resData);
    };
  }

  disconnect() {
    this.ws.close();
  }

  send(data: unknown) {
    this.ws.send(JSON.stringify(data));
  }
}
