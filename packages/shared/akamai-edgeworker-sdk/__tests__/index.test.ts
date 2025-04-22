import { EdgeProvider, init, LDLogger, LDMultiKindContext, LDSingleKindContext } from '../dist';
import * as testData from './testData.json';

const createClient = (sdkKey: string, mockLogger: LDLogger, mockEdgeProvider: EdgeProvider) =>
  init({
    sdkKey,
    options: {
      logger: mockLogger,
      cacheTtlMs: 0,
    },
    featureStoreProvider: mockEdgeProvider,
    platformName: 'platform-name',
    sdkName: 'Akamai',
    sdkVersion: '0.0.1',
  });

describe('EdgeWorker', () => {
  const sdkKey = 'sdkKey';

  const mockLogger: LDLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const mockEdgeProvider: EdgeProvider = {
    get: jest.fn(),
  };

  const mockGet = mockEdgeProvider.get as jest.Mock;

  beforeEach(() => {
    mockGet.mockImplementation(() => Promise.resolve(JSON.stringify(testData)));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call edge providers get method only once', async () => {
    const client = createClient(sdkKey, mockLogger, mockEdgeProvider);
    await client.waitForInitialization();

    const context: LDMultiKindContext = { kind: 'multi', l: { key: 'key' } };

    await client.allFlagsState(context, { clientSideOnly: true });
    await client.variation('testFlag1', context, false);
    await client.variationDetail('testFlag1', context, false);

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('should successfully return data for allFlagsState', async () => {
    const client = createClient(sdkKey, mockLogger, mockEdgeProvider);
    await client.waitForInitialization();

    const context: LDMultiKindContext = { kind: 'multi', l: { key: 'key' } };

    const allFlags = await client.allFlagsState(context, { clientSideOnly: true });
    expect(allFlags.toJSON()).toEqual({
      $flagsState: {
        testFlag1: { debugEventsUntilDate: 2000, variation: 0, version: 2 },
        testFlag2: { debugEventsUntilDate: 2000, variation: 0, version: 2 },
      },
      $valid: true,
      testFlag1: true,
      testFlag2: true,
    });
  });

  it('should should successfully evaluate flags using a flag key', async () => {
    const client = createClient(sdkKey, mockLogger, mockEdgeProvider);
    await client.waitForInitialization();

    const context: LDMultiKindContext = { kind: 'multi', l: { key: 'key' } };

    const flagValue = await client.variation('testFlag1', context, false);
    expect(flagValue).toEqual(true);
  });

  it('should should successfully return flag evaluation details', async () => {
    const client = createClient(sdkKey, mockLogger, mockEdgeProvider);
    await client.waitForInitialization();

    const context: LDMultiKindContext = { kind: 'multi', l: { key: 'key' } };

    const detail = await client.variationDetail('testFlag1', context, false);
    expect(detail).toEqual({ reason: { kind: 'FALLTHROUGH' }, value: true, variationIndex: 0 });
  });

  it('should should successfully evaluate flags with segment data', async () => {
    const client = createClient(sdkKey, mockLogger, mockEdgeProvider);
    await client.waitForInitialization();

    const context: LDSingleKindContext = {
      kind: 'user',
      key: 'return-false-for-segment-target',
    };

    const flagValue = await client.variation('testFlag3', context, false);
    expect(flagValue).toEqual(false);
  });
});
