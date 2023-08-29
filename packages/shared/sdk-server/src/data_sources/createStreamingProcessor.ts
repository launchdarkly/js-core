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
  errorHandler?: internal.StreamingErrorHandler,
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();

  listeners.set('put', {
    deserializeData: deserializeAll,
    processJson: (json: AllData) => {
      const initData = {
        [VersionedDataKinds.Features.namespace]: json.data.flags,
        [VersionedDataKinds.Segments.namespace]: json.data.segments,
      };

      featureStore.init(initData, () => {
        // TODO:
        // if (!this.initialized()) {
        //   this.initState = InitState.Initialized;
        //   this.initResolve?.(this);
        //   this.onReady();
        // }
      });
    },
  });

  return new internal.StreamingProcessor(
    sdkKey,
    clientContext,
    listeners,
    diagnosticsManager,
    errorHandler,
  );
};

export default createStreamingProcessor;
