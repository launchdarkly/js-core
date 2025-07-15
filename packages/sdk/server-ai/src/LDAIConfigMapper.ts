import {
  LDMessage,
  LDModelConfig,
  LDProviderConfig,
  VercelAISDKConfig,
  VercelAISDKMapOptions,
  VercelAISDKProvider,
} from './api/config';

export class LDAIConfigMapper {
  constructor(
    private _model?: LDModelConfig | undefined,
    private _provider?: LDProviderConfig | undefined,
    private _messages?: LDMessage[] | undefined,
  ) {}

  private _findParameter<T>(...paramNames: string[]): T | undefined {
    for (let i = 0; i < paramNames.length; i += 1) {
      const paramName = paramNames[i];
      if (this._model?.parameters?.[paramName] !== undefined) {
        return this._model?.parameters?.[paramName] as T;
      }
      if (this._model?.custom?.[paramName] !== undefined) {
        return this._model?.custom?.[paramName] as T;
      }
    }
    return undefined;
  }

  toVercelAISDK<TMod>(
    provider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
    options?: VercelAISDKMapOptions | undefined,
  ): VercelAISDKConfig<TMod> {
    let model: TMod | undefined;
    if (typeof provider === 'function') {
      model = provider(this._model?.name ?? '');
    } else {
      model = provider[this._provider?.name ?? '']?.(this._model?.name ?? '');
    }

    let messages: LDMessage[] | undefined;
    if (this._messages || options?.nonInterpolatedMessages) {
      messages = [...(this._messages ?? []), ...(options?.nonInterpolatedMessages ?? [])];
    }

    return {
      model,
      messages,
      maxTokens: this._findParameter('max_tokens', 'maxTokens'),
      temperature: this._findParameter('temperature'),
      topP: this._findParameter('top_p', 'topP'),
      topK: this._findParameter('top_k', 'topK'),
      presencePenalty: this._findParameter('presence_penalty', 'presencePenalty'),
      frequencyPenalty: this._findParameter('frequency_penalty', 'frequencyPenalty'),
      stopSequences: this._findParameter('stop', 'stop_sequences', 'stopSequences'),
      seed: this._findParameter('seed'),
    };
  }
}
