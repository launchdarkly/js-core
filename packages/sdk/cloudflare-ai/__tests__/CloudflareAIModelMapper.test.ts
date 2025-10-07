import { CloudflareAIModelMapper } from '../src/CloudflareAIModelMapper';

describe('CloudflareAIModelMapper', () => {
  describe('mapParameters', () => {
    it('maps maxTokens to max_tokens', () => {
      const result = CloudflareAIModelMapper.mapParameters({ maxTokens: 100 });
      expect(result).toEqual({ max_tokens: 100 });
    });

    it('maps temperature parameter', () => {
      const result = CloudflareAIModelMapper.mapParameters({ temperature: 0.7 });
      expect(result).toEqual({ temperature: 0.7 });
    });

    it('maps multiple parameters', () => {
      const result = CloudflareAIModelMapper.mapParameters({
        maxTokens: 100,
        temperature: 0.7,
        topP: 0.9,
      });
      expect(result).toEqual({
        max_tokens: 100,
        temperature: 0.7,
        top_p: 0.9,
      });
    });

    it('handles snake_case parameters', () => {
      const result = CloudflareAIModelMapper.mapParameters({
        max_tokens: 100,
        top_p: 0.9,
      });
      expect(result).toEqual({
        max_tokens: 100,
        top_p: 0.9,
      });
    });

    it('passes through unknown parameters', () => {
      const result = CloudflareAIModelMapper.mapParameters({
        customParam: 'value',
        anotherParam: 123,
      });
      expect(result).toEqual({
        customParam: 'value',
        anotherParam: 123,
      });
    });
  });

  describe('toCloudflareWorkersAI', () => {
    it('creates basic config with model ID', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
      });

      expect(config.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    });

    it('includes messages when provided', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello!' },
        ],
      });

      expect(config.messages).toEqual([
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
      ]);
    });

    it('includes model parameters', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI({
        model: {
          name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          parameters: {
            temperature: 0.7,
            maxTokens: 1000,
          },
        },
      });

      expect(config.temperature).toBe(0.7);
      expect(config.max_tokens).toBe(1000);
    });

    it('applies model override from options', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI(
        { model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' } },
        { modelOverride: '@cf/meta/llama-3.1-8b-instruct-fast' },
      );

      expect(config.model).toBe('@cf/meta/llama-3.1-8b-instruct-fast');
    });

    it('applies stream option', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI(
        { model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' } },
        { stream: true },
      );

      expect(config.stream).toBe(true);
    });

    it('merges additional parameters', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI(
        { model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' } },
        { additionalParams: { custom: 'value', another: 123 } },
      );

      expect(config.custom).toBe('value');
      expect(config.another).toBe(123);
    });

    it('uses empty model when none provided', () => {
      const config = CloudflareAIModelMapper.toCloudflareWorkersAI({});
      expect(config.model).toBe('');
    });
  });
});
