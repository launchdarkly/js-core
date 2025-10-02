import { AIMessage, HumanMessage, SystemMessage } from 'langchain/schema';

import { LangChainProvider } from '../src/LangChainProvider';

describe('LangChainProvider', () => {
  describe('convertMessagesToLangChain', () => {
    it('converts system messages to SystemMessage', () => {
      const messages = [{ role: 'system' as const, content: 'You are a helpful assistant.' }];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[0].content).toBe('You are a helpful assistant.');
    });

    it('converts user messages to HumanMessage', () => {
      const messages = [{ role: 'user' as const, content: 'Hello, how are you?' }];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(HumanMessage);
      expect(result[0].content).toBe('Hello, how are you?');
    });

    it('converts assistant messages to AIMessage', () => {
      const messages = [{ role: 'assistant' as const, content: 'I am doing well, thank you!' }];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(AIMessage);
      expect(result[0].content).toBe('I am doing well, thank you!');
    });

    it('converts multiple messages in order', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'What is the weather like?' },
        { role: 'assistant' as const, content: 'I cannot check the weather.' },
      ];
      const result = LangChainProvider.convertMessagesToLangChain(messages);

      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(SystemMessage);
      expect(result[1]).toBeInstanceOf(HumanMessage);
      expect(result[2]).toBeInstanceOf(AIMessage);
    });

    it('throws error for unsupported message role', () => {
      const messages = [{ role: 'unknown' as any, content: 'Test message' }];

      expect(() => LangChainProvider.convertMessagesToLangChain(messages)).toThrow(
        'Unsupported message role: unknown'
      );
    });

    it('handles empty message array', () => {
      const result = LangChainProvider.convertMessagesToLangChain([]);

      expect(result).toHaveLength(0);
    });
  });
});
