import { LDClientContext, subsystem, VoidFunction } from '@launchdarkly/js-sdk-common';

import { LDFeatureStore } from '../../api';
import { createStreamListeners } from '../../data_sources/createStreamListeners';
import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';
import AsyncStoreFacade from '../../store/AsyncStoreFacade';
import { processFlag, processSegment } from '../../store/serialization';
import VersionedDataKinds from '../../store/VersionedDataKinds';
import TestDataFlagBuilder from './TestDataFlagBuilder';
import TestDataSource from './TestDataSource';

/**
 * A mechanism for providing dynamically updatable feature flag state in a simplified form to an SDK
 * client in test scenarios.
 *
 * Unlike `FileData`, this mechanism does not use any external resources. It provides only the
 * data that the application has put into it using the {@link TestData.update} method.
 *
 * ```
 *     // Import TestData from the integrations package of the SDK you are using.
 *     // This is a common implementation and may be used in multiple SDKs.
 *
 *     const td = TestData();
 *     testData.update(td.flag("flag-key-1").booleanFlag().variationForAll(true));
 *     // Use the initialization mechanism specified by your SDK.
 *     const client = LDClient.init(sdkKey, { updateProcessor: td.getFactory() });
 *
 *     // flags can be updated at any time:
 *     td.update(td.flag("flag-key-2")
 *         .variationForContext("user", "some-user-key", true)
 *         .fallthroughVariation(false));
 * ```
 *
 * The above example uses a simple boolean flag, but more complex configurations are possible using
 * the methods of the {@link TestDataFlagBuilder} that is returned by {@link TestData.flag}.
 * {@link TestDataFlagBuilder} supports many of the ways a flag can be configured on the
 * LaunchDarkly dashboard, but does not currently support
 *  1. rule operators other than "in" and "not in", or
 *  2. percentage rollouts.
 *
 * If the same `TestData` instance is used to configure multiple `LDClient` instances,
 * any changes made to the data will propagate to all of the `LDClient`s.
 */
export default class TestData {
  private _currentFlags: Record<string, Flag> = {};

  private _currentSegments: Record<string, Segment> = {};

  private _dataSources: TestDataSource[] = [];

  private _flagBuilders: Record<string, TestDataFlagBuilder> = {};

  /**
   * Get a factory for update processors that will be attached to this TestData instance.
   * @returns An update processor factory.
   */
  getFactory(): (
    clientContext: LDClientContext,
    featureStore: LDFeatureStore,
    initSuccessHandler: VoidFunction,
    errorHandler?: (e: Error) => void,
  ) => subsystem.LDStreamProcessor {
    // Provides an arrow function to prevent needed to bind the method to
    // maintain `this`.
    return (
      clientContext: LDClientContext,
      featureStore: LDFeatureStore,
      initSuccessHandler: VoidFunction,
      _errorHandler?: (e: Error) => void,
    ) => {
      const listeners = createStreamListeners(
        featureStore,
        clientContext.basicConfiguration.logger,
        {
          put: initSuccessHandler,
        },
      );
      const newSource = new TestDataSource(
        new AsyncStoreFacade(featureStore),
        this._currentFlags,
        this._currentSegments,
        (tds) => {
          this._dataSources.splice(this._dataSources.indexOf(tds));
        },
        listeners,
      );

      this._dataSources.push(newSource);
      return newSource;
    };
  }

  /**
   * Creates or copies a {@link TestDataFlagBuilder} for building a test flag configuration.
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
   * {@link TestData.update}.
   *
   * @param key the flag key
   * @returns a flag configuration builder
   *
   */
  flag(key: string): TestDataFlagBuilder {
    if (this._flagBuilders[key]) {
      return this._flagBuilders[key].clone();
    }
    return new TestDataFlagBuilder(key).booleanFlag();
  }

  /**
   * Updates the test data with the specified flag configuration.
   *
   * This has the same effect as if a flag were added or modified in the
   * LaunchDarkly dashboard. It immediately propagates the flag changes to
   * any `LDClient` instance(s) that you have already configured to use
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
    const oldItem = this._currentFlags[flagKey];
    const oldVersion = oldItem ? oldItem.version : 0;
    const newFlag = flagBuilder.build(oldVersion + 1);
    this._currentFlags[flagKey] = newFlag;
    this._flagBuilders[flagKey] = flagBuilder.clone();

    return Promise.all(
      this._dataSources.map((impl) => impl.upsert(VersionedDataKinds.Features, newFlag)),
    );
  }

  /**
   * Copies a full feature flag data model object into the test data.
   *
   * It immediately propagates the flag change to any `LDClient` instance(s) that you have already
   * configured to use this `TestData`. If no `LDClient` has been started yet, it simply adds this
   * flag to the test data which will be provided to any LDClient that you subsequently configure.
   *
   * Use this method if you need to use advanced flag configuration properties that are not
   * supported by the simplified {@link TestDataFlagBuilder} API. Otherwise it is recommended to use
   * the regular {@link flag}/{@link update} mechanism to avoid dependencies on details of the data
   * model.
   *
   * You cannot make incremental changes with {@link flag}/{@link update} to a flag that has been
   * added in this way; you can only replace it with an entirely new flag configuration.
   *
   * @param flagConfig the flag configuration as a JSON object
   * @return a promise that will resolve when the feature stores are updated
   */
  usePreconfiguredFlag(inConfig: any): Promise<any> {
    // We need to do things like process attribute reference, and
    // we do not want to modify the passed in value.
    const flagConfig = JSON.parse(JSON.stringify(inConfig));
    const oldItem = this._currentFlags[flagConfig.key];
    const newItem = { ...flagConfig, version: oldItem ? oldItem.version + 1 : flagConfig.version };
    processFlag(newItem);
    this._currentFlags[flagConfig.key] = newItem;

    return Promise.all(
      this._dataSources.map((impl) => impl.upsert(VersionedDataKinds.Features, newItem)),
    );
  }

  /**
   * Copies a full segment data model object into the test data.
   *
   * It immediately propagates the change to any `LDClient` instance(s) that you have already
   * configured to use this `TestData`. If no `LDClient` has been started yet, it simply adds
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

    const oldItem = this._currentSegments[segmentConfig.key];
    const newItem = {
      ...segmentConfig,
      version: oldItem ? oldItem.version + 1 : segmentConfig.version,
    };
    processSegment(newItem);
    this._currentSegments[segmentConfig.key] = newItem;

    return Promise.all(
      this._dataSources.map((impl) => impl.upsert(VersionedDataKinds.Segments, newItem)),
    );
  }
}
