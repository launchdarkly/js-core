import {
  CreateInstanceParams,
  TestHarnessWebSocket as BaseTestHarnessWebSocket,
} from '@launchdarkly/js-contract-test-utils/client';

import { CommandHandler } from './ClientEntity';

export default class TestHarnessWebSocket extends BaseTestHarnessWebSocket {
  constructor(
    url: string,
    private readonly _commandHandlers: Map<string, CommandHandler>,
    private readonly _onCreateClient: (params: CreateInstanceParams) => Promise<string>,
    private readonly _onDeleteClient: (id: string) => void,
  ) {
    super(url);
  }

  protected createClient(params: CreateInstanceParams): Promise<string> {
    return this._onCreateClient(params);
  }

  protected getCommandHandler(id: string): CommandHandler | undefined {
    return this._commandHandlers.get(id);
  }

  protected deleteClient(id: string): boolean {
    this._onDeleteClient(id);
    return true;
  }
}
