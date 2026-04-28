import { initChatModel } from 'langchain/chat_models/universal';

import type { LDAIAgentConfig, LDAICompletionConfig } from '@launchdarkly/server-sdk-ai';

import { LangChainAgentRunner } from '../src/LangChainAgentRunner';
import { LangChainModelRunner } from '../src/LangChainModelRunner';
import { LangChainRunnerFactory } from '../src/LangChainRunnerFactory';

jest.mock('langchain/chat_models/universal', () => ({
  initChatModel: jest.fn(),
}));

const mockInitChatModel = initChatModel as jest.MockedFunction<typeof initChatModel>;

describe('LangChainRunnerFactory', () => {
  let factory: LangChainRunnerFactory;
  const fakeLLM = { invoke: jest.fn(), bindTools: jest.fn() };

  beforeEach(() => {
    factory = new LangChainRunnerFactory();
    mockInitChatModel.mockReset();
    mockInitChatModel.mockResolvedValue(fakeLLM as any);
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
    it('strips tools from parameters before initialising the chat model', async () => {
      const tools = [{ name: 'lookup' }];
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
      expect(runner).toBeInstanceOf(LangChainAgentRunner);
    });
  });

  describe('create', () => {
    it('creates a LangChainRunnerFactory instance', async () => {
      const f = await LangChainRunnerFactory.create();
      expect(f).toBeInstanceOf(LangChainRunnerFactory);
    });
  });
});
