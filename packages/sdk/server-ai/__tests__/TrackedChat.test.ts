import { TrackedChat } from '../src/api/chat/TrackedChat';
import { ChatResponse } from '../src/api/chat/types';
import { LDAIConfig, LDMessage } from '../src/api/config/LDAIConfig';
import { LDAIConfigTracker } from '../src/api/config/LDAIConfigTracker';
import { AIProvider } from '../src/api/providers/AIProvider';

describe('TrackedChat', () => {
  let mockProvider: jest.Mocked<AIProvider>;
  let mockTracker: jest.Mocked<LDAIConfigTracker>;
  let aiConfig: LDAIConfig;

  beforeEach(() => {
    // Mock the AIProvider
    mockProvider = {
      invokeModel: jest.fn(),
    } as any;

    // Mock the LDAIConfigTracker
    mockTracker = {
      trackMetricsOf: jest.fn(),
      trackDuration: jest.fn(),
      trackTokens: jest.fn(),
      trackSuccess: jest.fn(),
      trackError: jest.fn(),
      trackFeedback: jest.fn(),
      trackTimeToFirstToken: jest.fn(),
      trackDurationOf: jest.fn(),
      trackOpenAIMetrics: jest.fn(),
      trackBedrockConverseMetrics: jest.fn(),
      trackVercelAIMetrics: jest.fn(),
      getSummary: jest.fn(),
    } as any;

    // Create a basic AI config
    aiConfig = {
      enabled: true,
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: { name: 'gpt-4' },
      provider: { name: 'openai' },
      tracker: mockTracker,
      toVercelAISDK: jest.fn(),
    };
  });

  describe('appendMessages', () => {
    it('appends messages to the conversation history', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      const messagesToAppend: LDMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      chat.appendMessages(messagesToAppend);

      const messages = chat.getMessages(false);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('appends multiple message batches sequentially', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([{ role: 'user', content: 'First message' }]);
      chat.appendMessages([{ role: 'assistant', content: 'Second message' }]);
      chat.appendMessages([{ role: 'user', content: 'Third message' }]);

      const messages = chat.getMessages(false);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
      expect(messages[2].content).toBe('Third message');
    });

    it('handles empty message array', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([]);

      const messages = chat.getMessages(false);
      expect(messages).toHaveLength(0);
    });
  });

  describe('getMessages', () => {
    it('returns only conversation history when includeConfigMessages is false', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
      ]);

      const messages = chat.getMessages(false);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'User message' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Assistant message' });
    });

    it('returns only conversation history when includeConfigMessages is omitted (defaults to false)', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([{ role: 'user', content: 'User message' }]);

      const messages = chat.getMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'user', content: 'User message' });
    });

    it('returns config messages prepended when includeConfigMessages is true', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
      ]);

      const messages = chat.getMessages(true);

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
      expect(messages[1]).toEqual({ role: 'user', content: 'User message' });
      expect(messages[2]).toEqual({ role: 'assistant', content: 'Assistant message' });
    });

    it('returns only config messages when no conversation history exists and includeConfigMessages is true', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      const messages = chat.getMessages(true);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    });

    it('returns empty array when no messages exist and includeConfigMessages is false', () => {
      const configWithoutMessages: LDAIConfig = {
        ...aiConfig,
        messages: [],
      };
      const chat = new TrackedChat(configWithoutMessages, mockTracker, mockProvider);

      const messages = chat.getMessages(false);

      expect(messages).toHaveLength(0);
    });

    it('returns a copy of the messages array (not a reference)', () => {
      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([{ role: 'user', content: 'Original message' }]);

      const messages1 = chat.getMessages();
      const messages2 = chat.getMessages();

      expect(messages1).not.toBe(messages2);
      expect(messages1).toEqual(messages2);

      // Modifying returned array should not affect internal state
      messages1.push({ role: 'assistant', content: 'Modified' });

      const messages3 = chat.getMessages();
      expect(messages3).toHaveLength(1);
      expect(messages3[0].content).toBe('Original message');
    });

    it('handles undefined config messages gracefully', () => {
      const configWithoutMessages: LDAIConfig = {
        ...aiConfig,
        messages: undefined,
      };
      const chat = new TrackedChat(configWithoutMessages, mockTracker, mockProvider);

      chat.appendMessages([{ role: 'user', content: 'User message' }]);

      const messagesWithConfig = chat.getMessages(true);
      expect(messagesWithConfig).toHaveLength(1);
      expect(messagesWithConfig[0].content).toBe('User message');

      const messagesWithoutConfig = chat.getMessages(false);
      expect(messagesWithoutConfig).toHaveLength(1);
      expect(messagesWithoutConfig[0].content).toBe('User message');
    });
  });

  describe('integration with invoke', () => {
    it('adds messages from invoke to history accessible via getMessages', async () => {
      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'Response from model' },
        metrics: { success: true },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());

      mockProvider.invokeModel.mockResolvedValue(mockResponse);

      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      await chat.invoke('Hello');

      const messages = chat.getMessages(false);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Response from model' });
    });

    it('preserves appended messages when invoking', async () => {
      const mockResponse: ChatResponse = {
        message: { role: 'assistant', content: 'Response' },
        metrics: { success: true },
      };

      mockTracker.trackMetricsOf.mockImplementation(async (extractor, func) => func());

      mockProvider.invokeModel.mockResolvedValue(mockResponse);

      const chat = new TrackedChat(aiConfig, mockTracker, mockProvider);

      chat.appendMessages([{ role: 'user', content: 'Pre-appended message' }]);
      await chat.invoke('New user input');

      const messages = chat.getMessages(false);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Pre-appended message');
      expect(messages[1].content).toBe('New user input');
      expect(messages[2].content).toBe('Response');
    });
  });
});
