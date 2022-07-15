import { LDStreamProcessor } from '../../api';
import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import Configuration from '../../options/Configuration';
import AsyncStoreFacade from '../../store/AsyncStoreFacade';
import { processFlag, processSegment } from '../../store/serialization';
import VersionedDataKinds from '../../store/VersionedDataKinds';
import TestDataFlagBuilder from './TestDataFlagBuilder';
import TestDataSource from './TestDataSource';

/**
 * A mechanism for providing dynamically updatable feature flag state in a simplified form to an SDK
 * client in test scenarios.
 *
 * Unlike [[FileData]], this mechanism does not use any external resources. It provides only the
 * data that the application has put into it using the [[TestData.update]] method.
 *
 * @example
 *     TKTK: Needs updating when we know the package name.
 *     const { TestData } = require('launchdarkly-node-server-sdk/interfaces');
 *
 *     const td = TestData();
 *     testData.update(td.flag("flag-key-1").booleanFlag().variationForAll(true));
 *     TKTK: May need to update this, depending on how we show importing the client.
 *     const client = LDClient.init(sdkKey, { updateProcessor: td.getFactory() });
 *
 *     // flags can be updated at any time:
 *     td.update(td.flag("flag-key-2")
 *         .variationForContext("user", "some-user-key", true)
 *         .fallthroughVariation(false));
 *
 * The above example uses a simple boolean flag, but more complex configurations are possible using
 * the methods of the [[TestDataFlagBuilder]] that is returned by [[TestData.flag]].
 * [[TestDataFlagBuilder]] supports many of the ways a flag can be configured on the LaunchDarkly
 * dashboard, but does not currently support
 *  1. rule operators other than "in" and "not in", or
 *  2. percentage rollouts.
 *
 * If the same `TestData` instance is used to configure multiple `LDClient` instances,
 * any changes made to the data will propagate to all of the `LDClient`s.
 *
 * @see [[FileDataSource]]
 */
export default class TestData {
  private currentFlags: Record<string, Flag> = {};

  private currentSegments: Record<string, Segment> = {};

  private dataSources: TestDataSource[] = [];

  private flagBuilders: Record<string, TestDataFlagBuilder> = {};

  /**
   * Get a factory for update processors that will be attached to this TestData instance.
   * @returns An update processor factory.
   */
  getFactory(): (config: Configuration) => LDStreamProcessor {
    // Provides an arrow function to prevent needed to bind the method to
    // maintain `this`.
    return (config: Configuration) => {
      const newSource = new TestDataSource(
        new AsyncStoreFacade(config.featureStore),
        this.currentFlags,

        this.currentSegments,
        (tds) => {
          this.dataSources.splice(this.dataSources.indexOf(tds));
        },
      );

      this.dataSources.push(newSource);
      return newSource;
    };
  }

  /**
   * Creates or copies a [[TestDataFlagBuilder]] for building a test flag configuration.
   *
   * If the flag key has already been defined in this `TestData` instance,
   * then the builder starts with the same configuration that was last
   * provided for this flag.
   *
   * Otherwise, it starts with a new default configuration in which the flag
   * has `true` and `false` variations, is `true` for all users when targeting
   * is turned on and `false` otherwise, and currently has targeting turned on.
   * You can change any of those properties and provide more complex behavior
   * using the `TestDataFlagBuilder` methods.
   *
   * Once you have set the desired configuration, pass the builder to
   * [[TestData.update]].
   *
   * @param key the flag key
   * @returns a flag configuration builder
   *
   */
  flag(key: string): TestDataFlagBuilder {
    if (this.flagBuilders[key]) {
      return this.flagBuilders[key].clone();
    }
    return new TestDataFlagBuilder(key).booleanFlag();
  }

  /**
   * Updates the test data with the specified flag configuration.
   *
   * This has the same effect as if a flag were added or modified in the
   * LaunchDarkly dashboard. It immediately propagates the flag changes to
   * any [[LDClient]] instance(s) that you have already configured to use
   * this `TestData`. If no `LDClient` has been started yet, it simply adds
   * this flag to the test data which will be provided to any `LDClient`
   * that you subsequently configure.
   *
   * Any subsequent changes to this `TestDataFlagBuilder` instance do not affect
   * the test data unless you call `update` again.
   *
   * @param flagBuilder a flag configuration builder
   * @return a promise that will resolve when the feature stores are updated
   */
  update(flagBuilder: TestDataFlagBuilder): Promise<any> {
    const flagKey = flagBuilder.getKey();
    const oldItem = this.currentFlags[flagKey];
    const oldVersion = oldItem ? oldItem.version : 0;
    const newFlag = flagBuilder.build(oldVersion + 1);
    this.currentFlags[flagKey] = newFlag;
    this.flagBuilders[flagKey] = flagBuilder.clone();

    return Promise.all(
      this.dataSources.map((impl) => impl.upsert(VersionedDataKinds.Features, newFlag)),
    );
  }

  /**
   * Copies a full feature flag data model object into the test data.
   *
   * It immediately propagates the flag change to any [[LDClient]] instance(s) that you have already
   * configured to use this `TestData`. If no [[LDClient]] has been started yet, it simply adds this
   * flag to the test data which will be provided to any LDClient that you subsequently configure.
   *
   * Use this method if you need to use advanced flag configuration properties that are not
   * supported by the simplified [[TestDataFlagBuilder]] API. Otherwise it is recommended to use the
   * regular [[flag]]/[[update]] mechanism to avoid dependencies on details of the data model.
   *
   * You cannot make incremental changes with [[flag]]/[[update]] to a flag that has been added in
   * this way; you can only replace it with an entirely new flag configuration.
   *
   * @param flagConfig the flag configuration as a JSON object
   * @return a promise that will resolve when the feature stores are updated
   */
  usePreconfiguredFlag(inConfig: any): Promise<any> {
    // We need to do things like process attribute reference, and
    // we do not want to modify the passed in value.
    const flagConfig = JSON.parse(JSON.stringify(inConfig));
    const oldItem = this.currentFlags[flagConfig.key];
    const newItem = { ...flagConfig, version: oldItem ? oldItem.version + 1 : flagConfig.version };
    processFlag(newItem);
    this.currentFlags[flagConfig.key] = newItem;

    return Promise.all(
      this.dataSources.map((impl) => impl.upsert(VersionedDataKinds.Features, newItem)),
    );
  }

  /**
   * Copies a full segment data model object into the test data.
   *
   * It immediately propagates the change to any [[LDClient]] instance(s) that you have already
   * configured to use this `TestData`. If no [[LDClient]] has been started yet, it simply adds
   * this segment to the test data which will be provided to any LDClient that you subsequently
   * configure.
   *
   * This method is currently the only way to inject segment data, since there is no builder
   * API for segments. It is mainly intended for the SDK's own tests of segment functionality,
   * since application tests that need to produce a desired evaluation state could do so more easily
   * by just setting flag values.
   *
   * @param segmentConfig the segment configuration as a JSON object
   * @return a promise that will resolve when the feature stores are updated
   */
  usePreconfiguredSegment(inConfig: any): Promise<any> {
    const segmentConfig = JSON.parse(JSON.stringify(inConfig));

    const oldItem = this.currentSegments[segmentConfig.key];
    const newItem = {
      ...segmentConfig,
      version: oldItem ? oldItem.version + 1 : segmentConfig.version,
    };
    processFlag(newItem);
    this.currentSegments[segmentConfig.key] = newItem;

    return Promise.all(
      this.dataSources.map((impl) => impl.upsert(VersionedDataKinds.Segments, newItem)),
    );
  }
}
