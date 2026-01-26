// eslint-disable no-console

export default class AdaptorWebSocket {
  private _ws?: WebSocket;

  constructor(private readonly _url: string) {}

  connect() {
    console.log(`Connecting to web socket.`);
    this._ws = new WebSocket(this._url, ['v1']);
    this._ws.onopen = () => {
      console.log('Connected to websocket.');
    };
    this._ws.onclose = () => {
      console.log('Websocket closed. Attempting to reconnect in 1 second.');
      setTimeout(() => {
        this.connect();
      }, 1000);
    };
    this._ws.onerror = (err) => {
      console.log(`error:`, err);
    };

    this._ws.onmessage = async (msg) => {
      console.log('Test harness message', msg);
      const data = JSON.parse(msg.data);
      const resData: any = { reqId: data.reqId };
      // TODO: currently copied from the browser contract tests
      // will need to figure out what the actual capabilities are.
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
        case 'createClient':
        case 'runCommand':
        case 'deleteClient':
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
