import * as Mustache from 'mustache';

import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfig, LDGenerationConfig, LDMessage, LDModelConfig } from './api/config';
import { LDAIClient } from './api/LDAIClient';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';
import { LDClientMin } from './LDClientMin';

/**
 * Metadata assorted with a model configuration variation.
 */
interface LDMeta {
  versionKey: string;
  enabled: boolean;
}

/**
 * Interface for the model configuration variation returned by LaunchDarkly. This is the internal
 * typing and not meant for exposure to the application developer.
 */
interface VariationContent {
  model?: LDModelConfig;
  prompt?: LDMessage[];
  _ldMeta?: LDMeta;
}

export class LDAIClientImpl implements LDAIClient {
  constructor(private _ldClient: LDClientMin) {}

  interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return Mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  async modelConfig<TDefault extends LDGenerationConfig>(
    key: string,
    context: LDContext,
    defaultValue: TDefault,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig> {
    const value: VariationContent = await this._ldClient.variation(key, context, defaultValue);
    // We are going to modify the contents before returning them, so we make a copy.
    // This isn't a deep copy and the application developer should not modify the returned content.
    const config: LDGenerationConfig = { ...value };
    const allVariables = { ...variables, ldctx: context };

    if (value.prompt) {
      config.prompt = value.prompt.map((entry: any) => ({
        ...entry,
        content: this.interpolateTemplate(entry.content, allVariables),
      }));
    }

    return {
      config,
      // eslint-disable-next-line no-underscore-dangle
      tracker: new LDAIConfigTrackerImpl(
        this._ldClient,
        key,
        // eslint-disable-next-line no-underscore-dangle
        value._ldMeta?.versionKey ?? '',
        context,
      ),
      // eslint-disable-next-line no-underscore-dangle
      enabled: !!value._ldMeta?.enabled,
    };
  }
}
