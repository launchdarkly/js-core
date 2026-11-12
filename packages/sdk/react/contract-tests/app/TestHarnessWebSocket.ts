import {
  CreateInstanceParams,
  TestHarnessWebSocket as BaseTestHarnessWebSocket,
} from '@launchdarkly/js-contract-test-utils/client';

import { CommandHandler } from './ClientEntity';

const CAPABILITIES = [
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
  'client-independence',
  'evaluation-hooks',
  'track-hooks',
  'secure-mode-hash',
  'polling-gzip',
  'fdv1-fallback',
  'bootstrap',
];

export default class TestHarnessWebSocket extends BaseTestHarnessWebSocket {
  constructor(
    url: string,
    private readonly _commandHandlers: Map<string, CommandHandler>,
    private readonly _onCreateClient: (params: CreateInstanceParams) => Promise<string>,
    private readonly _onDeleteClient: (id: string) => void,
  ) {
    super(url, { capabilities: CAPABILITIES });
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
