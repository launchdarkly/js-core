import {
  CLIENT_SIDE_CAPABILITIES,
  IClientEntity,
  TestHarnessWebSocketBuilder,
} from '@launchdarkly/js-contract-test-utils/client';

import { newSdkClientEntity } from './ClientEntity';

export function createTestHarnessWebSocket() {
  const entities = new Map<string, IClientEntity>();

  return new TestHarnessWebSocketBuilder()
    .setCapabilities(CLIENT_SIDE_CAPABILITIES)
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
