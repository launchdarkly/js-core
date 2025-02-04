import * as Mustache from 'mustache';

import { LDContext } from '@launchdarkly/js-server-sdk-common';

import { LDAIConfig, LDAIDefaults, LDMessage, LDModelConfig, LDProviderConfig } from './api/config';
import { LDAIClient } from './api/LDAIClient';
import { LDAIConfigTrackerImpl } from './LDAIConfigTrackerImpl';
import { LDClientMin } from './LDClientMin';

/**
 * Metadata assorted with a model configuration variation.
 */
interface LDMeta {
  variationKey: string;
  enabled: boolean;
  version?: number;
}

/**
 * Interface for the model configuration variation returned by LaunchDarkly. This is the internal
 * typing and not meant for exposure to the application developer.
 */
interface VariationContent {
  model?: LDModelConfig;
  messages?: LDMessage[];
  provider?: LDProviderConfig;
  _ldMeta?: LDMeta;
}

export class LDAIClientImpl implements LDAIClient {
  constructor(private _ldClient: LDClientMin) {}

  private _interpolateTemplate(template: string, variables: Record<string, unknown>): string {
    return Mustache.render(template, variables, undefined, { escape: (item: any) => item });
  }

  async config(
    key: string,
    context: LDContext,
    defaultValue: LDAIDefaults,
    variables?: Record<string, unknown>,
  ): Promise<LDAIConfig> {
    const value: VariationContent = await this._ldClient.variation(key, context, defaultValue);
    const tracker = new LDAIConfigTrackerImpl(
      this._ldClient,
      key,
      // eslint-disable-next-line no-underscore-dangle
      value._ldMeta?.variationKey ?? '',
      // eslint-disable-next-line no-underscore-dangle
      value._ldMeta?.version ?? 1,
      context,
    );
    // eslint-disable-next-line no-underscore-dangle
    const enabled = !!value._ldMeta?.enabled;
    const config: LDAIConfig = {
      tracker,
      enabled,
    };
    // We are going to modify the contents before returning them, so we make a copy.
    // This isn't a deep copy and the application developer should not modify the returned content.
    if (value.model) {
      config.model = { ...value.model };
    }
    if (value.provider) {
      config.provider = { ...value.provider };
    }
    const allVariables = { ...variables, ldctx: context };

    if (value.messages) {
      config.messages = value.messages.map((entry: any) => ({
        ...entry,
        content: this._interpolateTemplate(entry.content, allVariables),
      }));
    }

    return config;
  }
}
