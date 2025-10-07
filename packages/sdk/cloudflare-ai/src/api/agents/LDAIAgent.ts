import type { LDAIConfig } from '../config/LDAIConfig';

export interface LDAIAgent extends Omit<LDAIConfig, 'messages' | 'toWorkersAI'> {
  instructions?: string;
}

export interface LDAIAgentConfig {
  key: string;
  defaultValue: LDAIAgentDefaults;
  variables?: Record<string, unknown>;
}

export interface LDAIAgentDefaults {
  enabled: boolean;
  instructions?: string;
  model?: LDAIConfig['model'];
  provider?: LDAIConfig['provider'];
}
