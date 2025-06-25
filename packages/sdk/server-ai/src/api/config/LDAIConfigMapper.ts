import { type LDMessage } from './LDAIConfig';

export type VercelAISDKProvider<TMod> = (modelName: string) => TMod;

export interface VercelAISDKMapOptions {
  nonInterpolatedMessages?: LDMessage[] | undefined;
}

export interface VercelAISDKConfig<TMod> {
  model: TMod;
  messages?: LDMessage[] | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  topP?: number | undefined;
  topK?: number | undefined;
  presencePenalty?: number | undefined;
  frequencyPenalty?: number | undefined;
  stopSequences?: string[] | undefined;
  seed?: number | undefined;
}

export interface LDAIConfigMapper {
  toVercelAISDK: <TMod>(
    provider: VercelAISDKProvider<TMod> | Record<string, VercelAISDKProvider<TMod>>,
    options?: VercelAISDKMapOptions | undefined,
  ) => VercelAISDKConfig<TMod>;
}
