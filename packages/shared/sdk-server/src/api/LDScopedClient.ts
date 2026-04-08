import {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagValue,
  LDSingleKindContext,
} from '@launchdarkly/js-sdk-common';

import { LDMigrationOpEvent, LDMigrationVariation } from './data';
import { LDFlagsState } from './data/LDFlagsState';
import { LDFlagsStateOptions } from './data/LDFlagsStateOptions';
import { LDMigrationStage } from './data/LDMigrationStage';
import type { LDClient } from './LDClient';

/**
 * A scoped client wraps a base {@link LDClient} with one or more evaluation contexts,
 * providing a client-side-like API where variation and track calls do not require
 * a context parameter.
 *
 * @remarks
 * The scoped client maintains a mutable, additive container of contexts that can be
 * built up incrementally as more information becomes available during a request.
 * Context kinds can be added or overwritten, but not removed.
 *
 * Create a scoped client using {@link LDClient.forContext}.
 *
 * The scoped client is **not** an independent SDK instance — it delegates all
 * operations to the underlying base client. Multiple scoped clients created from
 * the same base client are fully independent.
 */
export interface LDScopedClient {
  /**
   * Adds a single-kind context to this scoped client's context container.
   *
   * @remarks
   * If a context with the same kind already exists, the duplicate is rejected
   * and a warning is logged. Use {@link overwriteContextByKind} for intentional
   * replacement.
   *
   * @param context A single-kind context to add.
   * @returns This scoped client, for chaining.
   */
  addContext(context: LDSingleKindContext): LDScopedClient;

  /**
   * Replaces an existing context of the same kind, or adds it if the kind
   * does not yet exist.
   *
   * @remarks
   * This is the escape hatch for updating context attributes when new information
   * becomes available during a request lifecycle.
   *
   * @param context A single-kind context to set.
   * @returns This scoped client, for chaining.
   */
  overwriteContextByKind(context: LDSingleKindContext): LDScopedClient;

  /**
   * Returns the evaluation context representing all contexts added to
   * this scoped client.
   *
   * @returns The combined evaluation context.
   */
  currentContext(): LDContext;

  /**
   * The underlying base {@link LDClient}.
   */
  readonly client: LDClient;

  /**
   * Determines the variation of a feature flag for the current context.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag.
   * @returns A Promise resolved with the result value.
   */
  variation(key: string, defaultValue: LDFlagValue): Promise<LDFlagValue>;

  /**
   * Determines the variation of a feature flag for the current context,
   * along with information about how it was calculated.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default value of the flag.
   * @returns A Promise resolved with the evaluation detail.
   */
  variationDetail(key: string, defaultValue: LDFlagValue): Promise<LDEvaluationDetail>;

  /**
   * Determines the boolean variation of a feature flag for the current context.
   */
  boolVariation(key: string, defaultValue: boolean): Promise<boolean>;

  /**
   * Determines the numeric variation of a feature flag for the current context.
   */
  numberVariation(key: string, defaultValue: number): Promise<number>;

  /**
   * Determines the string variation of a feature flag for the current context.
   */
  stringVariation(key: string, defaultValue: string): Promise<string>;

  /**
   * Determines the JSON variation of a feature flag for the current context.
   */
  jsonVariation(key: string, defaultValue: unknown): Promise<unknown>;

  /**
   * Determines the boolean variation of a feature flag, along with evaluation details.
   */
  boolVariationDetail(
    key: string,
    defaultValue: boolean,
  ): Promise<LDEvaluationDetailTyped<boolean>>;

  /**
   * Determines the numeric variation of a feature flag, along with evaluation details.
   */
  numberVariationDetail(
    key: string,
    defaultValue: number,
  ): Promise<LDEvaluationDetailTyped<number>>;

  /**
   * Determines the string variation of a feature flag, along with evaluation details.
   */
  stringVariationDetail(
    key: string,
    defaultValue: string,
  ): Promise<LDEvaluationDetailTyped<string>>;

  /**
   * Determines the JSON variation of a feature flag, along with evaluation details.
   */
  jsonVariationDetail(
    key: string,
    defaultValue: unknown,
  ): Promise<LDEvaluationDetailTyped<unknown>>;

  /**
   * Returns the migration stage of the migration feature flag for the current context.
   *
   * @param key The unique key of the feature flag.
   * @param defaultValue The default migration stage.
   * @returns A Promise resolved with the migration variation.
   */
  migrationVariation(key: string, defaultValue: LDMigrationStage): Promise<LDMigrationVariation>;

  /**
   * Builds an object encapsulating the state of all feature flags for the current context.
   *
   * @param options Optional flags state options.
   * @returns A Promise resolved with the flags state.
   */
  allFlagsState(options?: LDFlagsStateOptions): Promise<LDFlagsState>;

  /**
   * Tracks that the current context performed an event.
   *
   * @param key The name of the event.
   */
  track(key: string): void;

  /**
   * Tracks that the current context performed an event with additional data.
   *
   * @param key The name of the event.
   * @param data Additional information to associate with the event.
   */
  trackData(key: string, data: any): void;

  /**
   * Tracks a numeric metric event for the current context.
   *
   * @param key The name of the event.
   * @param metricValue A numeric value used by LaunchDarkly experimentation.
   * @param data Optional additional information to associate with the event.
   */
  trackMetric(key: string, metricValue: number, data?: any): void;

  /**
   * Track the details of a migration.
   *
   * @param event Event containing information about the migration operation.
   */
  trackMigration(event: LDMigrationOpEvent): void;
}
