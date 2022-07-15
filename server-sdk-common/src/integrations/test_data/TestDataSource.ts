import { LDStreamProcessor } from '../api';
import { DataKind } from '../api/interfaces';
import { LDKeyedFeatureStoreItem } from '../api/subsystems';
import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import AsyncStoreFacade from '../store/AsyncStoreFacade';
import VersionedDataKinds from '../store/VersionedDataKinds';

/**
 * @internal
 */
export class TestDataSource implements LDStreamProcessor {
  constructor(
    private readonly featureStore: AsyncStoreFacade,
    private readonly flags: Record<string, Flag>,
    private readonly segments: Record<string, Segment>,
    private readonly onStop: (tfs: TestDataSource) => void) {
  }
  async start(fn?: ((err?: any) => void) | undefined) {
    await this.featureStore.init({
      [VersionedDataKinds.Features.namespace]: { ...this.flags },
      [VersionedDataKinds.Segments.namespace]: { ...this.segments },
    });
    fn?.();
  }

  stop() {
    this.onStop(this);
  }

  close() {
    this.stop();
  }

  async upsert(kind: DataKind, value: LDKeyedFeatureStoreItem) {
    this.featureStore.upsert(kind, value);
  }
}
