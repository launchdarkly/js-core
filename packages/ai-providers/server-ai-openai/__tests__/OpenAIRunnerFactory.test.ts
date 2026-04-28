import { OpenAI } from 'openai';

import type { LDAIAgentConfig, LDAICompletionConfig } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner } from '../src/OpenAIAgentRunner';
import { OpenAIModelRunner } from '../src/OpenAIModelRunner';
import { OpenAIRunnerFactory } from '../src/OpenAIRunnerFactory';

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

describe('OpenAIRunnerFactory', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let factory: OpenAIRunnerFactory;

  beforeEach(() => {
    mockOpenAI = new OpenAI() as jest.Mocked<OpenAI>;
    factory = new OpenAIRunnerFactory(mockOpenAI);
  });

  describe('createModel', () => {
    it('builds an OpenAIModelRunner that shares the factory client', () => {
      const config: LDAICompletionConfig = {
        key: 'completion',
        enabled: true,
        model: { name: 'gpt-4o', parameters: { temperature: 0.5 } },
      };

      const runner = factory.createModel(config);

      expect(runner).toBeInstanceOf(OpenAIModelRunner);
      expect(runner.getClient()).toBe(mockOpenAI);
    });

    it('builds a model runner from a minimal config', () => {
      const runner = factory.createModel({ key: 'completion', enabled: true });
      expect(runner).toBeInstanceOf(OpenAIModelRunner);
    });
  });

  describe('createAgent', () => {
    it('builds an OpenAIAgentRunner without tools when none are configured', () => {
      const config: LDAIAgentConfig = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o' },
        instructions: 'be helpful',
      };

      const runner = factory.createAgent(config);

      expect(runner).toBeInstanceOf(OpenAIAgentRunner);
    });

    it('extracts tool definitions from model.parameters.tools', () => {
      const tools = [{ type: 'function', function: { name: 'lookup' } }];
      const config: LDAIAgentConfig = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o', parameters: { tools, temperature: 0.7 } },
        instructions: 'be helpful',
      };

      const runner = factory.createAgent(config, { lookup: () => 'ok' });

      expect(runner).toBeInstanceOf(OpenAIAgentRunner);
    });
  });

  describe('getClient', () => {
    it('returns the underlying OpenAI client', () => {
      expect(factory.getClient()).toBe(mockOpenAI);
    });
  });

  describe('create', () => {
    it('creates an OpenAIRunnerFactory instance', async () => {
      const f = await OpenAIRunnerFactory.create();
      expect(f).toBeInstanceOf(OpenAIRunnerFactory);
      expect(f.getClient()).toBeDefined();
    });
  });
});
