import { LDAIConfig } from '../config';

/**
 * AI Config agent and tracker.
 */
export interface LDAIAgent extends Omit<LDAIConfig, 'messages'> {
  /**
   * Instructions for the agent.
   */
  instructions?: string;
}

export type LDAIAgents<TKey extends string> = Record<TKey, LDAIAgent>;

/**
 * Default value for a `modelConfig`. This is the same as the LDAIAgent, but it does not include
 * a tracker and `enabled` is optional.
 */
export type LDAIAgentDefaults = Omit<LDAIAgent, 'tracker' | 'enabled'> & {
  /**
   * Whether the agent configuration is enabled.
   *
   * defaults to false
   */
  enabled?: boolean;
};
