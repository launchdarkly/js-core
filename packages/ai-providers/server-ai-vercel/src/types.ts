import type { LDMessage } from '@launchdarkly/server-sdk-ai';

/**
 * Vercel AI SDK Provider type - a function that takes a model name and returns a model instance.
 */
export type VercelAISDKProvider<TMod> = (modelName: string) => TMod;

/**
 * Options for mapping to Vercel AI SDK configuration.
 */
export interface VercelAISDKMapOptions {
  /**
   * Additional messages that should not be interpolated.
   */
  nonInterpolatedMessages?: LDMessage[] | undefined;
}

/**
 * Vercel AI SDK model parameters.
 * These are the parameters that can be passed to Vercel AI SDK methods like generateText() and streamText().
 */
export interface VercelAIModelParameters {
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

/**
 * Configuration format compatible with Vercel AI SDK's generateText() and streamText() methods.
 */
export interface VercelAISDKConfig<TMod> extends VercelAIModelParameters {
  model: TMod;
  messages?: LDMessage[] | undefined;
}
