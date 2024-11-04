import Mustache from 'mustache';

import { LDClient, LDContext } from '@launchdarkly/node-server-sdk';

import { AIClient } from './api/AIClient';
import { LDAIConfig, LDGenerationConfig, LDModelConfig, LDPrompt } from './api/config';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';

interface LDMeta {
  versionId: string;
}

interface VariationContent {
  model?: LDModelConfig;
  prompt?: LDPrompt[];
  _ldMeta?: LDMeta;
}

export class AIClientImpl implements AIClient {
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

/**
 * Initialize a new AI client. This client will be used to perform any AI operations.
 * @param ldClient The base LaunchDarkly client.
 * @returns A new AI client.
 */
export function initAi(ldClient: LDClient): AIClient {
  return new AIClientImpl(ldClient);
}

export * from './api';
