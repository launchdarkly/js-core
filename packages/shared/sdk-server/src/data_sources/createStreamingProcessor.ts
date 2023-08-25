import {
  type ClientContext,
  EventName,
  internal,
  ProcessStreamResponse,
} from '@launchdarkly/js-sdk-common';

import { LDDataSourceUpdates } from '../api/subsystems';
import { AllData, deserializeAll } from '../store/serialization';
import VersionedDataKinds from '../store/VersionedDataKinds';

const createStreamingProcessor = (
  sdkKey: string,
  clientContext: ClientContext,
  featureStore: LDDataSourceUpdates,
  diagnosticsManager?: internal.DiagnosticsManager,
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();

  // TODO: simplify the way we add listeners to StreamingProcessor
  listeners.set('put', {
    deserialize: deserializeAll,
    process: (json: AllData) => {
      const initData = {
        [VersionedDataKinds.Features.namespace]: json.data.flags,
        [VersionedDataKinds.Segments.namespace]: json.data.segments,
      };

      // TODO: fix errorHandler function
      // featureStore.init(initData, () => fn?.());
      featureStore.init(initData, () => '');
    },
  });

  return new internal.StreamingProcessor(sdkKey, clientContext, listeners, diagnosticsManager);
};

export default createStreamingProcessor;
