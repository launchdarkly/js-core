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
  key: string;

  /**
   * Default configuration for the agent.
   */
  defaultValue: LDAIAgentDefaults;

  /**
   * Variables for instructions interpolation.
   */
  variables?: Record<string, unknown>;
}

/**
 * Default values for an agent.
 */
export type LDAIAgentDefaults = Omit<LDAIAgent, 'tracker'>;
