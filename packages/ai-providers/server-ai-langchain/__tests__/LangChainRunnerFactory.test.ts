import { createAgent } from 'langchain';
import { initChatModel } from 'langchain/chat_models/universal';

import type { LDAIAgentConfig, LDAICompletionConfig } from '@launchdarkly/server-sdk-ai';

import { LangChainAgentRunner } from '../src/LangChainAgentRunner';
import { LangChainModelRunner } from '../src/LangChainModelRunner';
import { LangChainRunnerFactory } from '../src/LangChainRunnerFactory';

jest.mock('langchain/chat_models/universal', () => ({
  initChatModel: jest.fn(),
}));

jest.mock('langchain', () => ({
  createAgent: jest.fn(),
}));

const mockInitChatModel = initChatModel as jest.MockedFunction<typeof initChatModel>;
const mockCreateAgent = createAgent as jest.MockedFunction<typeof createAgent>;

describe('LangChainRunnerFactory', () => {
  let factory: LangChainRunnerFactory;
  const fakeLLM = { invoke: jest.fn(), bindTools: jest.fn() };
  const fakeCompiledAgent = { invoke: jest.fn() };

  beforeEach(() => {
    factory = new LangChainRunnerFactory();
    mockInitChatModel.mockReset();
    mockCreateAgent.mockReset();
    mockInitChatModel.mockResolvedValue(fakeLLM as any);
    mockCreateAgent.mockReturnValue(fakeCompiledAgent as any);
  });

  describe('createModel', () => {
    it('builds a LangChainModelRunner with model and parameters from the config', async () => {
      const config: LDAICompletionConfig = {
        key: 'completion',
        enabled: true,
        provider: { name: 'openai' },
        model: { name: 'gpt-4o', parameters: { temperature: 0.5 } },
      };

      const runner = await factory.createModel(config);

      expect(mockInitChatModel).toHaveBeenCalledWith('gpt-4o', {
        temperature: 0.5,
        modelProvider: 'openai',
      });
      expect(runner).toBeInstanceOf(LangChainModelRunner);
    });

    it('maps gemini provider to google-genai', async () => {
      await factory.createModel({
        key: 'completion',
        enabled: true,
        provider: { name: 'gemini' },
        model: { name: 'gemini-2.0' },
      });

      expect(mockInitChatModel).toHaveBeenCalledWith('gemini-2.0', {
        modelProvider: 'google-genai',
      });
    });
  });

  describe('createAgent', () => {
    it('strips tools from parameters and passes them to createAgent', async () => {
      const tools = [{ name: 'lookup', description: 'looks up a value' }];
      const config: LDAIAgentConfig = {
        key: 'agent',
        enabled: true,
        provider: { name: 'openai' },
        model: { name: 'gpt-4o', parameters: { temperature: 0.7, tools } },
        instructions: 'be helpful',
      };

      const runner = await factory.createAgent(config, { lookup: () => 'ok' });

      expect(mockInitChatModel).toHaveBeenCalledWith('gpt-4o', {
        temperature: 0.7,
        modelProvider: 'openai',
      });
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: fakeLLM,
          systemPrompt: 'be helpful',
        }),
      );
      expect(mockCreateAgent.mock.calls[0][0].tools).toHaveLength(1);
      expect(runner).toBeInstanceOf(LangChainAgentRunner);
    });

    it('passes undefined tools to createAgent when no tool definitions exist', async () => {
      const config: LDAIAgentConfig = {
        key: 'agent',
        enabled: true,
        provider: { name: 'openai' },
        model: { name: 'gpt-4o' },
        instructions: '',
      };

      await factory.createAgent(config);

      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: fakeLLM,
          tools: undefined,
          systemPrompt: undefined,
        }),
      );
    });
  });

});
