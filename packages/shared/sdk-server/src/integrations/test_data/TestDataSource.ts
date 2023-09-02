import { EventName, ProcessStreamResponse, subsystem } from '@launchdarkly/js-sdk-common';

import { DataKind, LDKeyedFeatureStoreItem } from '../../api';
import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import AsyncStoreFacade from '../../store/AsyncStoreFacade';

/**
 * @internal
 */
export default class TestDataSource implements subsystem.LDStreamProcessor {
  private readonly flags: Record<string, Flag>;
  private readonly segments: Record<string, Segment>;
  constructor(
    private readonly featureStore: AsyncStoreFacade,
    initialFlags: Record<string, Flag>,
    initialSegments: Record<string, Segment>,
    private readonly onStop: (tfs: TestDataSource) => void,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
  ) {
    // make copies of these objects to decouple them from the originals
    // so updates made to the originals don't affect these internal data.
    this.flags = { ...initialFlags };
    this.segments = { ...initialSegments };
  }

  async start() {
    this.listeners.forEach(({ processJson }) => {
      const dataJson = { data: { flags: this.flags, segments: this.segments } };
      processJson(dataJson);
    });
  }

  stop() {
    this.onStop(this);
  }

  close() {
    this.stop();
  }

  async upsert(kind: DataKind, value: LDKeyedFeatureStoreItem) {
    return this.featureStore.upsert(kind, value);
  }
}
