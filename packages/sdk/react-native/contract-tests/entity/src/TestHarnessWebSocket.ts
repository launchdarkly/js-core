import {
  CommandParams,
  CreateInstanceParams,
  TestHarnessWebSocket as BaseTestHarnessWebSocket,
} from '@launchdarkly/js-contract-test-utils/client';

import { ClientEntity, newSdkClientEntity } from './ClientEntity';

const CAPABILITIES = [
            'client-side',
            'mobile',
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
            'client-event-source-http-errors',
            'retry-conformance-fdv1-streaming',
            'retry-conformance-fdv1-polling',
            'bootstrap',
          ];

export default class TestHarnessWebSocket extends BaseTestHarnessWebSocket {
  constructor(url: string, onConnectionChange?: (connected: boolean) => void) {
    super(url, { capabilities: CAPABILITIES, onConnectionChange });
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
