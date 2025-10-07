import type {
  CloudflareAIConfig,
  CloudflareAIMapOptions,
  LDMessage,
  LDModelConfig,
} from './api/config/LDAIConfig';

/**
 * Maps model names and parameters to Cloudflare Workers AI format.
 */
export class CloudflareAIModelMapper {
  /**
   * Maps parameter names to Cloudflare Workers AI format.
   *
   * @param params The parameters to map.
   * @returns The mapped parameters.
   */
  static mapParameters(params: Record<string, unknown>): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    Object.entries(params).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase();

      if (normalizedKey === 'maxtokens' || normalizedKey === 'max_tokens') {
        mapped.max_tokens = value;
      } else if (normalizedKey === 'topp' || normalizedKey === 'top_p') {
        mapped.top_p = value;
      } else if (normalizedKey === 'topk' || normalizedKey === 'top_k') {
        mapped.top_k = value;
      } else if (normalizedKey === 'frequencypenalty' || normalizedKey === 'frequency_penalty') {
        mapped.frequency_penalty = value;
      } else if (normalizedKey === 'presencepenalty' || normalizedKey === 'presence_penalty') {
        mapped.presence_penalty = value;
      } else if (normalizedKey === 'temperature') {
        mapped.temperature = value;
      } else {
        mapped[key] = value;
      }
    });

    return mapped;
  }

  /**
   * Converts a LaunchDarkly AI config to Cloudflare Workers AI format.
   *
   * @param config The LaunchDarkly AI configuration.
   * @param options Optional mapping options.
   * @returns Configuration ready for Cloudflare Workers AI.
   */
  static toCloudflareWorkersAI(
    config: {
      model?: LDModelConfig;
      messages?: LDMessage[];
    },
    options?: CloudflareAIMapOptions,
  ): CloudflareAIConfig {
    const modelId = options?.modelOverride || config.model?.name || '';

    const cfConfig: CloudflareAIConfig = {
      model: modelId,
    };

    if (config.messages && config.messages.length > 0) {
      cfConfig.messages = config.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    }

    if (config.model?.parameters) {
      const mappedParams = this.mapParameters(config.model.parameters);
      Object.assign(cfConfig, mappedParams);
    }

    if (options?.stream !== undefined) {
      cfConfig.stream = options.stream;
    }

    if (options?.additionalParams) {
      Object.assign(cfConfig, options.additionalParams);
    }

    return cfConfig;
  }
}
