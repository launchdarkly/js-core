import { LDAIClientImpl } from '../src/LDAIClientImpl';
import type { LDClientMin } from '../src/LDClientMin';

describe('LDAIClient', () => {
  let mockLDClient: jest.Mocked<LDClientMin>;
  let aiClient: LDAIClientImpl;

  beforeEach(() => {
    mockLDClient = {
      variation: jest.fn(),
      track: jest.fn(),
    };
    aiClient = new LDAIClientImpl(mockLDClient);
  });

  describe('config', () => {
    it('retrieves config from LaunchDarkly', async () => {
      mockLDClient.variation.mockResolvedValue({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        messages: [{ role: 'user', content: 'Hello' }],
        // eslint-disable-next-line no-underscore-dangle
        _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
      });

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'user-123' },
        { enabled: false },
      );

      expect(config.enabled).toBe(true);
      expect(config.model?.name).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      expect(config.messages).toHaveLength(1);
    });

    it('uses default value when LaunchDarkly returns it', async () => {
      const defaultValue = {
        enabled: false,
        model: { name: 'default-model' },
      };

      mockLDClient.variation.mockResolvedValue(defaultValue);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'user-123' },
        defaultValue,
      );

      expect(config.enabled).toBe(false);
      expect(config.model?.name).toBe('default-model');
    });

    it('interpolates variables in messages', async () => {
      mockLDClient.variation.mockResolvedValue({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        messages: [{ role: 'user', content: 'Hello {{username}}!' }],
        // eslint-disable-next-line no-underscore-dangle
        _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
      });

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'user-123' },
        { enabled: false },
        { username: 'Alice' },
      );

      expect(config.messages?.[0].content).toBe('Hello Alice!');
    });

    it('tracks config usage', async () => {
      mockLDClient.variation.mockResolvedValue({
        // eslint-disable-next-line no-underscore-dangle
        _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
      });

      await aiClient.config('test-config', { kind: 'user', key: 'user-123' }, { enabled: false });

      expect(mockLDClient.track).toHaveBeenCalledWith(
        '$ld:ai:config:function:single',
        { kind: 'user', key: 'user-123' },
        'test-config',
        1,
      );
    });

    it('provides toCloudflareWorkersAI conversion method', async () => {
      mockLDClient.variation.mockResolvedValue({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        messages: [{ role: 'user', content: 'Hello' }],
        // eslint-disable-next-line no-underscore-dangle
        _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
      });

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'user-123' },
        { enabled: false },
      );

      const cfConfig = config.toCloudflareWorkersAI();

      expect(cfConfig.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      expect(cfConfig.messages).toHaveLength(1);
    });

    it('includes provider information', async () => {
      mockLDClient.variation.mockResolvedValue({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        provider: { name: 'cloudflare-workers-ai' },
        // eslint-disable-next-line no-underscore-dangle
        _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
      });

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'user-123' },
        { enabled: false },
      );

      expect(config.provider?.name).toBe('cloudflare-workers-ai');
    });

    it('creates tracker with correct metadata', async () => {
      mockLDClient.variation.mockResolvedValue({
        model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
        provider: { name: 'cloudflare' },
        // eslint-disable-next-line no-underscore-dangle
        _ldMeta: { enabled: true, variationKey: 'variation-1', version: 2 },
      });

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'user-123' },
        { enabled: false },
      );

      expect(config.tracker).toBeDefined();

      config.tracker.trackSuccess();

      expect(mockLDClient.track).toHaveBeenCalledWith(
        '$ld:ai:generation',
        { kind: 'user', key: 'user-123' },
        expect.objectContaining({
          aiConfigKey: 'test-config',
          variationKey: 'variation-1',
          version: 2,
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          provider: 'cloudflare',
        }),
        1,
      );
    });
  });
});
