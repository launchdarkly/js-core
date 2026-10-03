import {
  LDKeyedFeatureStoreItem,
  LDOverrideSink,
  LDOverrideSource,
} from '../../src/api/subsystems';

export interface OverrideData {
  flags?: LDKeyedFeatureStoreItem[];
  segments?: LDKeyedFeatureStoreItem[];
}

/**
 * A programmatic override source for testing the override system without any file machinery.
 * It also serves as a reference for the seam an override source implements. Start delivers the
 * initial data synchronously. setOverrides pushes replacement snapshots to the sink at any time
 * afterward. With a deferred start, start returns a promise that the test completes.
 */
export default class TestOverrideSource implements LDOverrideSource {
  public sink?: LDOverrideSink;

  public closed = false;

  private _completeStart?: () => void;

  constructor(
    private readonly _initialData?: OverrideData,
    private readonly _deferStart: boolean = false,
  ) {}

  start(sink: LDOverrideSink): void | Promise<void> {
    this.sink = sink;
    if (this._initialData) {
      sink.setOverrides(this._initialData.flags ?? [], this._initialData.segments ?? []);
    }
    if (this._deferStart) {
      return new Promise<void>((resolve) => {
        this._completeStart = resolve;
      });
    }
    return undefined;
  }

  /**
   * Completes a deferred start.
   */
  completeStart() {
    this._completeStart?.();
  }

  /**
   * Replaces the override layer contents, as if the source's backing data had changed.
   */
  setOverrides(flags: LDKeyedFeatureStoreItem[], segments: LDKeyedFeatureStoreItem[] = []) {
    if (this.sink && !this.closed) {
      this.sink.setOverrides(flags, segments);
    }
  }

  close(): void {
    this.closed = true;
  }

  get started(): boolean {
    return this.sink !== undefined;
  }
}
