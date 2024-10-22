import { jest } from '@jest/globals';

import { LDContext, LDFlagSet, LDLogger } from '@launchdarkly/js-client-sdk-common';

const mockBrowserClient = {
  identify: jest.fn(),
  allFlags: jest.fn(),
  close: jest.fn(),
  flush: jest.fn(),
  _emitter: jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  })),
};

jest.unstable_mockModule('../../src/BrowserClient', () => ({
  __esModule: true,
  BrowserClient: jest.fn(),
}));

const { default: LDClientCompatImpl } = await import('../../src/compat/LDClientCompatImpl');

describe('given a LDClientCompatImpl client with mocked browser client', () => {
  // @ts-ignore
  let client: LDClientCompatImpl;
  // let mockBrowserClient: jest.Mocked<BrowserClient>;
  let mockLogger: LDLogger;

  beforeEach(() => {
    // mockBrowserClient = {
    //   identify: jest.fn(),
    //   allFlags: jest.fn(),
    //   close: jest.fn(),
    //   flush: jest.fn(),
    // } as unknown as jest.Mocked<BrowserClient>;

    // (BrowserClient as jest.MockedClass<typeof BrowserClient>).mockImplementation(
    //   () => mockBrowserClient,
    // );
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    };
    client = new LDClientCompatImpl(
      'env-key',
      { kind: 'user', key: 'user-key' },
      { logger: mockLogger },
    );
  });

  it('should return a promise from identify when no callback is provided', async () => {
    const context: LDContext = { kind: 'user', key: 'new-user' };
    const mockFlags: LDFlagSet = { flag1: true, flag2: false };
    // @ts-ignore
    mockBrowserClient.identify.mockResolvedValue(undefined);
    mockBrowserClient.allFlags.mockReturnValue(mockFlags);

    const result = await client.identify(context);

    expect(mockBrowserClient.identify).toHaveBeenCalledWith(context, { hash: undefined });
    expect(result).toEqual(mockFlags);
  });

  it('should call the callback when provided to identify', (done) => {
    const context: LDContext = { kind: 'user', key: 'new-user' };
    const mockFlags: LDFlagSet = { flag1: true, flag2: false };
    // @ts-ignore
    mockBrowserClient.identify.mockResolvedValue(undefined);
    mockBrowserClient.allFlags.mockReturnValue(mockFlags);

    // @ts-ignore
    client.identify(context, undefined, (err, flags) => {
      expect(err).toBeNull();
      expect(flags).toEqual(mockFlags);
      done();
    });
  });

  it('should return a promise from close when no callback is provided', async () => {
    // @ts-ignore
    mockBrowserClient.close.mockResolvedValue();

    await expect(client.close()).resolves.toBeUndefined();
    expect(mockBrowserClient.close).toHaveBeenCalled();
  });

  it('should call the callback when provided to close', (done) => {
    // @ts-ignore
    mockBrowserClient.close.mockResolvedValue();

    client.close(() => {
      expect(mockBrowserClient.close).toHaveBeenCalled();
      done();
    });
  });

  it('should return a promise from flush when no callback is provided', async () => {
    // @ts-ignore
    mockBrowserClient.flush.mockResolvedValue({ result: true });

    await expect(client.flush()).resolves.toBeUndefined();
    expect(mockBrowserClient.flush).toHaveBeenCalled();
  });

  it('should call the callback when provided to flush', (done) => {
    // @ts-ignore
    mockBrowserClient.flush.mockResolvedValue({ result: true });

    client.flush(() => {
      expect(mockBrowserClient.flush).toHaveBeenCalled();
      done();
    });
  });

  // it('should resolve immediately if the client is already initialized', async () => {
  //   mockBrowserClient.waitForInitialization.mockResolvedValue(undefined);

  //   await expect(client.waitForInitialization()).resolves.toBeUndefined();
  //   expect(mockBrowserClient.waitForInitialization).toHaveBeenCalledWith({ noTimeout: true });
  // });

  // it('should log a warning when no timeout is specified for waitForInitialization', async () => {
  //   mockBrowserClient.waitForInitialization.mockResolvedValue(undefined);

  //   await client.waitForInitialization();

  //   expect(mockLogger.warn).toHaveBeenCalledWith(
  //     expect.stringContaining('The waitForInitialization function was called without a timeout specified.')
  //   );
  // });

  // it('should apply a timeout when specified for waitForInitialization', async () => {
  //   mockBrowserClient.waitForInitialization.mockResolvedValue(undefined);

  //   await client.waitForInitialization(5);

  //   expect(mockBrowserClient.waitForInitialization).toHaveBeenCalledWith({ timeout: 5 });
  // });

  // it('should reject with a timeout error when initialization takes too long', async () => {
  //   mockBrowserClient.waitForInitialization.mockRejectedValue(new Error('Timeout'));

  //   await expect(client.waitForInitialization(1)).rejects.toThrow('Timeout');
  //   expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('waitForInitialization timed out'));
  // });
});
