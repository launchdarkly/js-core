import { makeLogger } from '../logging/makeLogger.js';
import { CommandParams } from '../types/CommandParams.js';
import { LDLogger } from '../types/compat.js';
import { CommandableClient } from './CommandableClient.js';
import { doCommand as doCommandFn } from './doCommand.js';
import { IClientEntity } from './TestHarnessWebSocket.js';

/**
 * Base client entity that wraps an SDK client and dispatches test harness
 * commands. Suitable for browser, react-native, and electron entities.
 *
 * Subclass and override `doCommand` to customize command handling for
 * platform-specific behavior.
 */
export class ClientEntity implements IClientEntity {
  protected readonly logger: LDLogger;
  protected readonly client: CommandableClient;

  constructor(client: CommandableClient, tag: string) {
    this.client = client;
    this.logger = makeLogger(tag);
  }

  close() {
    this.client.close();
    this.logger.info('Test ended');
  }

  async doCommand(params: CommandParams): Promise<unknown> {
    this.logger.info(`Received command: ${params.command}`);
    return doCommandFn(this.client, params);
  }
}
