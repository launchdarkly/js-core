import DiagnosticsManager from '../../../src/internal/diagnostics/DiagnosticsManager';
import { createBasicPlatform } from '../../createBasicPlatform';

describe('given a diagnostics manager', () => {
  const dateNowString = '2023-08-10';
  let manager: DiagnosticsManager;
  let mockPlatform: ReturnType<typeof createBasicPlatform>;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(dateNowString));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    mockPlatform = createBasicPlatform();
    mockPlatform.crypto.randomUUID.mockReturnValueOnce('random1').mockReturnValueOnce('random2');
    manager = new DiagnosticsManager('my-sdk-key', mockPlatform, { test1: 'value1' });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('uses the last 6 characters of the SDK key in the diagnostic id', () => {
    const { id } = manager.createInitEvent();
    expect(id.sdkKeySuffix).toEqual('dk-key');
  });

  it('creates random UUID', () => {
    const { id } = manager.createInitEvent();
    const manager2 = new DiagnosticsManager('my-sdk-key', mockPlatform, {});
    const { id: id2 } = manager2.createInitEvent();

    expect(id.diagnosticId).toBeTruthy();
    expect(id2.diagnosticId).toBeTruthy();
    expect(id.diagnosticId).not.toEqual(id2.diagnosticId);
  });

  it('puts the start time into the init event', () => {
    const { creationDate } = manager.createInitEvent();
    expect(creationDate).toEqual(Date.now());
  });

  it('puts SDK data into the init event', () => {
    const { sdk } = manager.createInitEvent();
    expect(sdk).toMatchObject(mockPlatform.info.sdkData());
  });

  it('puts config data into the init event', () => {
    const { configuration } = manager.createInitEvent();
    expect(configuration).toEqual({ test1: 'value1' });
  });

  it('puts platform data into the init event', () => {
    const { platform } = manager.createInitEvent();
    expect(platform).toEqual({
      name: 'The SDK Name',
      osName: 'An OS',
      osVersion: '1.0.1',
      osArch: 'An Arch',
      nodeVersion: '42',
    });
  });

  it('creates periodic event from stats, then resets', () => {
    const originalDate = Date.now();
    const streamInit1 = originalDate + 1;
    const streamInit2 = originalDate + 2;
    const statsCreation1 = originalDate + 3;
    const statsCreation2 = originalDate + 4;

    manager.recordStreamInit(streamInit1, true, 1000);
    manager.recordStreamInit(streamInit2, false, 550);
    jest.setSystemTime(statsCreation1);
    const statsEvent1 = manager.createStatsEventAndReset(4, 5, 6);

    expect(statsEvent1).toMatchObject({
      kind: 'diagnostic',
      creationDate: statsCreation1,
      dataSinceDate: originalDate,
      droppedEvents: 4,
      deduplicatedUsers: 5,
      eventsInLastBatch: 6,
      streamInits: [
        {
          timestamp: streamInit1,
          failed: true,
          durationMillis: 1000,
        },
        {
          timestamp: streamInit2,
          failed: false,
          durationMillis: 550,
        },
      ],
    });

    jest.setSystemTime(statsCreation2);
    const statsEvent2 = manager.createStatsEventAndReset(1, 2, 3);

    expect(statsEvent2).toMatchObject({
      kind: 'diagnostic',
      creationDate: statsCreation2,
      dataSinceDate: statsCreation1,
      droppedEvents: 1,
      deduplicatedUsers: 2,
      eventsInLastBatch: 3,
      streamInits: [],
    });
  });
});
