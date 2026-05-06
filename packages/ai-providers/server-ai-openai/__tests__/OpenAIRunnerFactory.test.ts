import type { LDAIAgentConfig, LDAICompletionConfig } from '@launchdarkly/server-sdk-ai';

import { OpenAIAgentRunner } from '../src/OpenAIAgentRunner';
import { OpenAIModelRunner } from '../src/OpenAIModelRunner';
import { OpenAIRunnerFactory } from '../src/OpenAIRunnerFactory';

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  })),
}));

const MockAgent = jest.fn().mockImplementation((opts: any) => opts);
const mockRun = jest.fn();
const mockTool = jest.fn((opts: any) => opts);

jest.mock('@openai/agents', () => ({
  Agent: MockAgent,
  run: (...args: any[]) => mockRun(...args),
  tool: (opts: any) => mockTool(opts),
}));

describe('OpenAIRunnerFactory', () => {
  let factory: OpenAIRunnerFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    factory = new OpenAIRunnerFactory();
  });

  describe('createModel', () => {
    it('builds an OpenAIModelRunner that shares the factory client', async () => {
      const config = {
        key: 'completion',
        enabled: true,
        model: { name: 'gpt-4o', parameters: { temperature: 0.5 } },
      } as unknown as LDAICompletionConfig;

      const runner = await factory.createModel(config);

      expect(runner).toBeInstanceOf(OpenAIModelRunner);
      expect(runner.getClient()).toBe(factory.getClient());
    });

    it('builds a model runner from a minimal config', async () => {
      const runner = await factory.createModel({ key: 'completion', enabled: true } as unknown as LDAICompletionConfig);
      expect(runner).toBeInstanceOf(OpenAIModelRunner);
    });
  });

  describe('createAgent', () => {
    it('builds an OpenAIAgentRunner without tools when none are configured', async () => {
      const config = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o' },
        instructions: 'be helpful',
      } as unknown as LDAIAgentConfig;

      const runner = await factory.createAgent(config);

      expect(runner).toBeInstanceOf(OpenAIAgentRunner);
    });

    it('passes instructions and model to the Agent constructor', async () => {
      const config = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o' },
        instructions: 'You are an expert.',
      } as unknown as LDAIAgentConfig;

      await factory.createAgent(config);

      expect(MockAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ldai-agent',
          model: 'gpt-4o',
          instructions: 'You are an expert.',
        }),
      );
    });

    it('maps model parameters to ModelSettings on the Agent', async () => {
      const config = {
        key: 'agent',
        enabled: true,
        model: {
          name: 'gpt-4o',
          parameters: { temperature: 0.7, top_p: 0.9, max_tokens: 1000 },
        },
        instructions: '',
      } as unknown as LDAIAgentConfig;

      await factory.createAgent(config);

      expect(MockAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          modelSettings: { temperature: 0.7, topP: 0.9, maxTokens: 1000 },
        }),
      );
    });

    it('extracts tool definitions from config.tools', async () => {
      const config = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o', parameters: { temperature: 0.7 } },
        tools: { lookup: { name: 'lookup', description: 'look things up' } },
        instructions: 'be helpful',
      } as unknown as LDAIAgentConfig;

      const runner = await factory.createAgent(config, { lookup: () => 'ok' });

      expect(runner).toBeInstanceOf(OpenAIAgentRunner);
      expect(mockTool).toHaveBeenCalled();
    });

    it('skips tools not in the registry and logs a warning', async () => {
      const warnMessages: string[] = [];
      const logger = { warn: (msg: string) => warnMessages.push(msg) } as any;
      const factoryWithLogger = new OpenAIRunnerFactory(logger);

      const config = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o' },
        tools: { missing: { name: 'missing', description: 'not provided', parameters: { type: 'object' } } },
        instructions: '',
      } as unknown as LDAIAgentConfig;

      await factoryWithLogger.createAgent(config, {});

      expect(warnMessages.some((m) => m.includes("'missing'"))).toBe(true);
    });

    it('passes through pre-built agent tool instances without wrapping', async () => {
      const hostedTool = { name: 'web_search', type: 'web_search_tool' };
      const config = {
        key: 'agent',
        enabled: true,
        model: { name: 'gpt-4o' },
        tools: { web_search: { name: 'web_search', description: 'search the web' } },
        instructions: '',
      } as unknown as LDAIAgentConfig;

      await factory.createAgent(config, { web_search: hostedTool });

      const agentOpts = MockAgent.mock.calls[MockAgent.mock.calls.length - 1][0];
      expect(agentOpts.tools).toContain(hostedTool);
      expect(mockTool).not.toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('returns the underlying OpenAI client', () => {
      expect(factory.getClient()).toBeDefined();
    });
  });
});
