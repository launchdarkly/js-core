import {
  CreateInstanceParams,
  TestHarnessWebSocket as BaseTestHarnessWebSocket,
} from '@launchdarkly/js-contract-test-utils/client';

import { ClientEntity, newSdkClientEntity, useFetchEventSource } from './ClientEntity';

const BASE_CAPABILITIES = [
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
  // The FDv1 streaming data source retries every HTTP error. On the
  // fetch transport an unexpected status retries after the extended
  // delay of minutes, which is longer than the legacy permanent-stop
  // tests watch, so those tests would pass for the wrong reason. The
  // native transport cannot report a status, so the harness already
  // skips those tests in native mode.
  'retry-conformance-fdv1-streaming',
];

// The native browser EventSource cannot send a POST request and hides HTTP error
// details. Only advertise the capabilities that need them when the run uses the
// fetch-based EventSource.
function browserCapabilities(): string[] {
  return useFetchEventSource()
    ? [...BASE_CAPABILITIES, 'client-use-post', 'client-event-source-http-errors']
    : BASE_CAPABILITIES;
}

export default class TestHarnessWebSocket extends BaseTestHarnessWebSocket {
  private readonly _entities: Record<string, ClientEntity> = {};
  private _clientCounter = 0;

  constructor(url: string) {
    super(url, { capabilities: browserCapabilities() });
  }

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
    return (params: Parameters<ClientEntity['doCommand']>[0]) =>
      this._entities[id].doCommand(params);
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
