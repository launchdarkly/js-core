import { VercelModelRunner } from '../src/VercelModelRunner';
import { VercelRunnerFactory } from '../src/VercelRunnerFactory';

describe('VercelRunnerFactory', () => {
  describe('createModel', () => {
    it('builds a VercelModelRunner with mapped parameters', async () => {
      const fakeModel = { name: 'gpt-4o' };
      jest.doMock('@ai-sdk/openai', () => ({
        openai: jest.fn().mockReturnValue(fakeModel),
      }));

      const factory = new VercelRunnerFactory();
      const runner = await factory.createModel({
        key: 'completion',
        enabled: true,
        provider: { name: 'openai' },
        model: { name: 'gpt-4o', parameters: { max_tokens: 100, temperature: 0.7 } },
      });

      expect(runner).toBeInstanceOf(VercelModelRunner);
      expect(runner.getModel()).toBe(fakeModel);
    });
  });

  describe('mapParameters', () => {
    it('maps known LD parameters to Vercel AI SDK names', () => {
      const params = VercelRunnerFactory.mapParameters({
        max_tokens: 100,
        max_completion_tokens: 200,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 50,
        presence_penalty: 0.1,
        frequency_penalty: 0.2,
        stop: ['x', 'y'],
        seed: 42,
      });

      expect(params).toEqual({
        maxTokens: 100,
        maxOutputTokens: 200,
        temperature: 0.7,
        topP: 0.9,
        topK: 50,
        presencePenalty: 0.1,
        frequencyPenalty: 0.2,
        stopSequences: ['x', 'y'],
        seed: 42,
      });
    });

    it('returns an empty object when parameters is undefined', () => {
      expect(VercelRunnerFactory.mapParameters(undefined)).toEqual({});
    });
  });

  describe('createVercelModel', () => {
    it('throws on an unsupported provider', async () => {
      await expect(
        VercelRunnerFactory.createVercelModel({
          key: 'k',
          enabled: true,
          provider: { name: 'unsupported' },
          model: { name: 'm' },
        }),
      ).rejects.toThrow('Unsupported Vercel AI provider: unsupported');
    });
  });

  describe('create', () => {
    it('creates a VercelRunnerFactory instance', async () => {
      const f = await VercelRunnerFactory.create();
      expect(f).toBeInstanceOf(VercelRunnerFactory);
    });
  });
});
