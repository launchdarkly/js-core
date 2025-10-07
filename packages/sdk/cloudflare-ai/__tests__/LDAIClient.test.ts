import { LDAIClientImpl } from '../src/LDAIClientImpl';
import type { LDClientMin } from '../src/LDClientMin';

describe('LDAIClient', () => {
  let mockLDClient: jest.Mocked<LDClientMin>;
  let aiClient: LDAIClientImpl;

  beforeEach(() => {
    mockLDClient = {
      variation: jest.fn(),
      variationDetail: jest.fn(),
      track: jest.fn(),
    };
    aiClient = new LDAIClientImpl(mockLDClient);
  });

  describe('config', () => {
    it('retrieves config from LaunchDarkly', async () => {
      mockLDClient.variationDetail.mockResolvedValue({
        value: {
          model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
          messages: [{ role: 'user', content: 'Hello' }],
          // eslint-disable-next-line no-underscore-dangle
          _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
        },
      } as any);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        {} as any,
      );

      expect(config.enabled).toBe(true);
      expect(config.model?.name).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      expect(config.messages).toHaveLength(1);
    });

    it('uses default value when LaunchDarkly returns it', async () => {
      const defaultValue = {
        model: { name: 'default-model' },
      };

      mockLDClient.variationDetail.mockResolvedValue({ value: defaultValue } as any);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        defaultValue,
      );

      expect(config.enabled).toBe(false);
      expect(config.model?.name).toBe('default-model');
    });

    it('interpolates variables in messages', async () => {
      mockLDClient.variationDetail.mockResolvedValue({
        value: {
          model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
          messages: [{ role: 'user', content: 'Hello {{username}}!' }],
          // eslint-disable-next-line no-underscore-dangle
          _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
        },
      } as any);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        {},
        { myVariable: 'My User Defined Variable' } as any,
      );

      expect(config.messages?.[0].content).toBe('Hello Alice!');
    });

    it('tracks config usage', async () => {
      mockLDClient.variationDetail.mockResolvedValue({
        value: {
          // eslint-disable-next-line no-underscore-dangle
          _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
        },
      } as any);

      await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        {} as any,
      );

      expect(mockLDClient.track).toHaveBeenCalledWith(
        '$ld:ai:config:function:single',
        { kind: 'user', key: 'user-123' },
        'test-config',
        1,
      );
    });

    it('provides toWorkersAI conversion method', async () => {
      mockLDClient.variationDetail.mockResolvedValue({
        value: {
          model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
          messages: [{ role: 'user', content: 'Hello' }],
          // eslint-disable-next-line no-underscore-dangle
          _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
        },
      } as any);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        {} as any,
      );

      const wc = (config as any).toWorkersAI({} as any);

      expect(wc.model).toBe('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      expect(wc.messages).toHaveLength(1);
    });

    it('includes provider information', async () => {
      mockLDClient.variationDetail.mockResolvedValue({
        value: {
          model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
          provider: { name: 'cloudflare-workers-ai' },
          // eslint-disable-next-line no-underscore-dangle
          _ldMeta: { enabled: true, variationKey: 'on', version: 1 },
        },
      } as any);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        {} as any,
      );

      expect(config.provider?.name).toBe('cloudflare-workers-ai');
    });

    it('creates tracker with correct metadata', async () => {
      mockLDClient.variationDetail.mockResolvedValue({
        value: {
          model: { name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
          provider: { name: 'cloudflare' },
          // eslint-disable-next-line no-underscore-dangle
          _ldMeta: { enabled: true, variationKey: 'variation-1', version: 2 },
        },
      } as any);

      const config = await aiClient.config(
        'test-config',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
        { enabled: false } as any,
      );

      expect(config.tracker).toBeDefined();

      config.tracker.trackSuccess();

      expect(mockLDClient.track).toHaveBeenCalledWith(
        '$ld:ai:generation',
        { kind: 'user', key: 'example-user-key', name: 'Sandy' },
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
