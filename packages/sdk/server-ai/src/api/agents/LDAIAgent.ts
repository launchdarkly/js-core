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

/**
 * Configuration for a single agent request.
 */
export interface LDAIAgentConfig {
  /**
   * The agent key to retrieve.
   */
  agentKey: string;

  /**
   * Default configuration for the agent.
   */
  defaultConfig: LDAIAgentDefaults;

  /**
   * Variables for instructions interpolation.
   */
  variables?: Record<string, unknown>;
}

/**
 * Default value for an agent configuration. This is the same as the LDAIAgent, but it does not include
 * a tracker and `enabled` is optional.
 */
export type LDAIAgentDefaults = Omit<LDAIAgent, 'tracker' | 'enabled'> & {
  /**
   * Whether the agent configuration is enabled.
   *
   * @default false
   */
  enabled?: boolean;
};
