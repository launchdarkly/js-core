import Mustache from 'mustache';

import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { LDAIConfig, LDGenerationConfig, LDModelConfig, LDPrompt } from './api/config';
import { LDAIClient } from './api/LDAIClient';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';

/**
 * Metadata assorted with a model configuration variation.
 */
interface LDMeta {
  versionId: string;
}

/**
 * Interface for the model configuration variation returned by LaunchDarkly. This is the internal
 * typing and not meant for exposure to the application developer.
 */
interface VariationContent {
  model?: LDModelConfig;
  prompt?: LDPrompt[];
  _ldMeta?: LDMeta;
}

export class LDAIClientImpl implements LDAIClient {
  private _ldClient: LDClient;

  constructor(ldClient: LDClient) {
    this._ldClient = ldClient;
  }

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
    const allVariables = { ldctx: context, ...variables };

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
        value._ldMeta?.versionId ?? '',
        context,
      ),
      noConfiguration: Object.keys(value).length === 0,
    };
  }
}
