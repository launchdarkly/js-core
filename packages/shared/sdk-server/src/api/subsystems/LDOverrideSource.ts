import { LDKeyedFeatureStoreItem } from './LDFeatureStore';

/**
 * Receives the contents of the SDK's flag and segment override layer. The SDK implements this
 * interface and passes it to {@link LDOverrideSource.start}. Override sources call it. They do
 * not implement it.
 *
 * Flag overrides are currently experimental and subject to change.
 */
export interface LDOverrideSink {
  /**
   * Replaces the entire override layer with the given flag and segment definitions. Each call is
   * a full snapshot. Entries absent from the call are removed from the layer, and empty arrays
   * clear the layer.
   *
   * The definitions are plain objects in the flag and segment data model, in the form in which
   * LaunchDarkly delivers them. The SDK copies them, prepares the copies for evaluation, and
   * marks the copies as override entries. It never modifies the objects it was given.
   *
   * The new contents are visible to evaluations when the call returns. Flag change notifications
   * for the affected flags follow.
   *
   * @param flags The full flag definitions of the layer.
   * @param segments The full segment definitions of the layer.
   */
  setOverrides(flags: LDKeyedFeatureStoreItem[], segments: LDKeyedFeatureStoreItem[]): void;
}

/**
 * Supplies flag and segment overrides that take precedence over LaunchDarkly data at evaluation
 * time, on a per-key basis. Overrides exist for resilience during an incident. They let an
 * operator force one or more flags to a known state on a running client, whether or not the
 * client can reach LaunchDarkly.
 *
 * An override source is not a data source. It takes no part in the data system's initializer and
 * synchronizer pipeline. The override layer it populates has no effect on the client's
 * initialization status or data source status.
 *
 * Configure an override source with the `overrides` property of the data system options.
 *
 * Flag overrides are currently experimental and subject to change.
 */
export interface LDOverrideSource {
  /**
   * Starts supplying overrides to the sink. An implementation performs its initial load and then
   * pushes a full replacement snapshot to the sink whenever its backing data changes, until
   * {@link close} is called. A failed load leaves the previously supplied layer untouched by not
   * calling the sink.
   *
   * The SDK calls this method once, when the client is created. When the initial load is
   * asynchronous, return a promise that settles when the load completes. The SDK waits for it
   * before it evaluates flags, so an override that is present at startup takes effect from the
   * first evaluation.
   *
   * @param sink The sink that receives the snapshots.
   */
  start(sink: LDOverrideSink): void | Promise<void>;

  /**
   * Stops the source and releases any resources it holds. The SDK calls this method when the
   * client is closed.
   */
  close(): void;
}
