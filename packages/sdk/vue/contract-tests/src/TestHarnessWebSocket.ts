import {
  CommandParams,
  CreateInstanceParams,
  TestHarnessWebSocket as BaseTestHarnessWebSocket,
} from '@launchdarkly/js-contract-test-utils/client';

import { ClientEntity, newSdkClientEntity } from './ClientEntity';

const CAPABILITIES = [
  'client-side',
  'service-endpoints',
  'tags',
  'user-type',
  'inline-context',
  'inline-context-all',
  'anonymous-redaction',
  'strongly-typed',
  'client-prereq-events',
  'client-per-context-summaries',
  'client-prereq-cycle-detection',
  'evaluation-hooks',
  'track-hooks',
  'secure-mode-hash',
  'flag-change-listeners',
  'fdv1-fallback',
  'bootstrap',
];

export default class TestHarnessWebSocket extends BaseTestHarnessWebSocket {
  constructor(url: string) {
    super(url, { capabilities: CAPABILITIES });
  }

  private readonly _entities: Record<string, ClientEntity> = {};
  private _clientCounter = 0;

  protected async createClient(params: CreateInstanceParams): Promise<string> {
    const entity = await newSdkClientEntity(params);
    const id = String(this._clientCounter);
    this._clientCounter += 1;
    this._entities[id] = entity;
    return id;
  }

  protected getCommandHandler(id: string) {
    if (!Object.prototype.hasOwnProperty.call(this._entities, id)) {
      return undefined;
    }
    return (params: CommandParams) => this._entities[id].doCommand(params);
  }

  protected deleteClient(id: string): boolean {
    if (!Object.prototype.hasOwnProperty.call(this._entities, id)) {
      return false;
    }
    this._entities[id].close();
    delete this._entities[id];
    return true;
  }
}
