import { type LDMessage } from './types';

/**
 * @deprecated Use `VercelAISDKProvider` from the `@launchdarkly/server-sdk-ai-vercel` package instead.
 * This type will be removed in a future version.
 */
export type VercelAISDKProvider<TMod> = (modelName: string) => TMod;

/**
 * @deprecated Use `VercelAISDKMapOptions` from the `@launchdarkly/server-sdk-ai-vercel` package instead.
 * This type will be removed in a future version.
 */
export interface VercelAISDKMapOptions {
  nonInterpolatedMessages?: LDMessage[] | undefined;
}

/**
 * @deprecated Use `VercelAISDKConfig` from the `@launchdarkly/server-sdk-ai-vercel` package instead.
 * This type will be removed in a future version.
 */
export interface VercelAISDKConfig<TMod> {
  model: TMod;
  messages?: LDMessage[] | undefined;
  maxTokens?: number | undefined;
  maxOutputTokens?: number | undefined;
  temperature?: number | undefined;
  topP?: number | undefined;
  topK?: number | undefined;
  presencePenalty?: number | undefined;
  frequencyPenalty?: number | undefined;
  stopSequences?: string[] | undefined;
  seed?: number | undefined;
}
