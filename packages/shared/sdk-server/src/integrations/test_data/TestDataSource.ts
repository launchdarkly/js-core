import { EventName, ProcessStreamResponse, subsystem } from '@launchdarkly/js-sdk-common';

import { DataKind, LDKeyedFeatureStoreItem } from '../../api';
import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import AsyncStoreFacade from '../../store/AsyncStoreFacade';

/**
 * @internal
 */
export default class TestDataSource implements subsystem.LDStreamProcessor {
  private readonly _flags: Record<string, Flag>;
  private readonly _segments: Record<string, Segment>;
  constructor(
    private readonly _featureStore: AsyncStoreFacade,
    initialFlags: Record<string, Flag>,
    initialSegments: Record<string, Segment>,
    private readonly _onStop: (tfs: TestDataSource) => void,
    private readonly _listeners: Map<EventName, ProcessStreamResponse>,
  ) {
    // make copies of these objects to decouple them from the originals
    // so updates made to the originals don't affect these internal data.
    this._flags = { ...initialFlags };
    this._segments = { ...initialSegments };
  }

  async start() {
    this._listeners.forEach(({ processJson }) => {
      const dataJson = { data: { flags: this._flags, segments: this._segments } };
      processJson(dataJson);
    });
  }

  stop() {
    this._onStop(this);
  }

  close() {
    this.stop();
  }

  async upsert(kind: DataKind, value: LDKeyedFeatureStoreItem) {
    return this._featureStore.upsert(kind, value);
  }
}
