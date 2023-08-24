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
  const {
    basicConfiguration: { logger },
  } = clientContext;
  const listeners = new Map<EventName, ProcessStreamResponse>();

  listeners.set('put', {
    // TODO: fix types
    deserialize: deserializeAll,
    processJson: (json: AllData) => {
      const initData = {
        [VersionedDataKinds.Features.namespace]: json.data.flags,
        [VersionedDataKinds.Segments.namespace]: json.data.segments,
      };

      featureStore.init(initData, () => fn?.());
    },
  });

  return new internal.StreamingProcessor(sdkKey, clientContext, listeners, diagnosticsManager);
};

export default createStreamingProcessor;
