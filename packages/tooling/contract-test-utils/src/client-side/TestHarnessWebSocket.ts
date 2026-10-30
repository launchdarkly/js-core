import { makeLogger } from '../logging/makeLogger.js';
import { CommandParams } from '../types/CommandParams.js';
import { LDLogger } from '../types/compat.js';
import { CreateInstanceParams } from '../types/ConfigParams.js';

export type CommandHandler = (params: CommandParams) => Promise<unknown>;

const DEFAULT_CAPABILITIES = [
  'client-side',
  'service-endpoints',
  'tags',
  'user-type',
  'inline-context-all',
  'anonymous-redaction',
  'strongly-typed',
  'client-prereq-events',
  'client-prereq-cycle-detection',
  'client-per-context-summaries',
  'track-hooks',
  'fdv1-fallback',
  'bootstrap',
];

export interface TestHarnessWebSocketOptions {
  /** Capabilities reported to the harness. Defaults to the browser list. */
  capabilities?: string[];
}

/**
 * Browser WebSocket connection to the contract test harness. It owns the
 * connect, reconnect, and command dispatch loop. Subclasses decide how clients
 * are created, looked up, and deleted.
 */
export default abstract class TestHarnessWebSocket {
  private _ws?: WebSocket;
  private _intentionalClose = false;
  protected readonly logger: LDLogger = makeLogger('TestHarnessWebSocket');

  constructor(
    private readonly _url: string,
    private readonly _options: TestHarnessWebSocketOptions = {},
  ) {}

  /**
   * Create a client and return the id the harness uses to address it.
   * Throw to report a failed creation.
   */
  protected abstract createClient(params: CreateInstanceParams): Promise<string>;

  /**
   * Return the command handler for a client, or undefined when no client has this id.
   */
  protected abstract getCommandHandler(id: string): CommandHandler | undefined;

  /**
   * Close and forget a client. Return false when no client has this id.
   */
  protected abstract deleteClient(id: string): boolean;

  connect() {
    this.logger.info(`Connecting to web socket.`);
    this._intentionalClose = false;
    this._ws = new WebSocket(this._url, ['v1']);
    this._ws.onopen = () => {
      this.logger.info('Connected to websocket.');
    };
    this._ws.onclose = () => {
      if (this._intentionalClose) {
        this.logger.info('Websocket closed.');
        return;
      }
      this.logger.info('Websocket closed. Attempting to reconnect in 1 second.');
      setTimeout(() => {
        // disconnect() may run while the reconnect timer is pending.
        if (!this._intentionalClose) {
          this.connect();
        }
      }, 1000);
    };
    this._ws.onerror = (err) => {
      this.logger.info(`error:`, err);
    };

    this._ws.onmessage = async (msg) => {
      this.logger.info('Test harness message', msg);
      const data = JSON.parse(msg.data);
      const resData: any = { reqId: data.reqId };

      switch (data.command) {
        case 'getCapabilities':
          resData.capabilities = this._options.capabilities ?? DEFAULT_CAPABILITIES;
          break;

        case 'createClient':
          try {
            const id = await this.createClient(data.body);
            resData.resourceUrl = `/clients/${id}`;
            resData.status = 201;
          } catch (e: any) {
            resData.status = 500;
            resData.error = e?.message ?? String(e);
          }
          break;

        case 'runCommand': {
          const handler = this.getCommandHandler(data.id);
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
            this.logger.warn(`Client did not exist: ${data.id}`);
          }
          break;
        }

        case 'deleteClient':
          if (this.deleteClient(data.id)) {
            resData.status = 200;
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
    this._intentionalClose = true;
    this._ws?.close();
  }

  send(data: unknown) {
    this._ws?.send(JSON.stringify(data));
  }
}
