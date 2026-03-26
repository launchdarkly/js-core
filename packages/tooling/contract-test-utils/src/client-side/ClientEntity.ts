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
 * platform-specific behavior. For example, React Native overrides to
 * handle async `flush()` differently.
 */
export class ClientEntity implements IClientEntity {
  protected readonly _logger: LDLogger;

  constructor(
    protected readonly _client: CommandableClient,
    tag: string,
  ) {
    this._logger = makeLogger(tag);
  }

  close() {
    this._client.close();
    this._logger.info('Test ended');
  }

  async doCommand(params: CommandParams): Promise<unknown> {
    this._logger.info(`Received command: ${params.command}`);
    return doCommandFn(this._client, params);
  }
}
