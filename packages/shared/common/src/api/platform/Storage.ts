/**
 * Interface for a data store that holds feature flag data and other SDK
 * properties in a serialized form.
 *
 * This interface should be used for platform-specific integrations that store
 * data somewhere other than in memory. Each data item is uniquely identified by
 * a string typically constructed following a namespacing structure that
 * is then encoded.
 *
 * Implementations may not throw exceptions.
 *
 * The SDK assumes that the persistence is only being used by a single instance
 * of the SDK per SDK key (two different SDK instances, with 2 different SDK
 * keys could use the same persistence instance).
 *
 * The SDK, with correct usage, will not have overlapping writes to the same
 * key.
 *
 * This interface does not depend on the ability to list the contents of the
 * store or namespaces. This is to maintain the simplicity of implementing a
 * key-value store on many platforms.
 */
export interface Storage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  clear: (key: string) => Promise<void>;
}
