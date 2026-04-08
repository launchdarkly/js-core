import {
  Capability,
  IClientEntity,
  TestHarnessWebSocketBuilder,
} from '@launchdarkly/js-contract-test-utils/client';

import { newSdkClientEntity } from './ClientEntity';

const CAPABILITIES: Capability[] = [
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

export function createTestHarnessWebSocket() {
  const entities = new Map<string, IClientEntity>();

  return new TestHarnessWebSocketBuilder()
    .setCapabilities(CAPABILITIES)
    .onCreateClient(async (id, params) => {
      const entity = await newSdkClientEntity(id, params);
      entities.set(id, entity);
      return entity;
    })
    .onGetClient((id) => entities.get(id))
    .onDeleteClient((id) => {
      entities.get(id)?.close();
      entities.delete(id);
    })
    .build();
}
