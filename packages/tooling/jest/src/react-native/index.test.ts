import {
  ldClientMock,
  mockFlags,
  mockLDProvider,
  mockReactNativeLDClient,
  mockUseLDClient,
  resetLDMocks,
} from '.';

describe('react-native', () => {
  afterEach(() => {
    resetLDMocks();
  });

  test('reset LD Mocks', () => {
    const current = mockUseLDClient();

    current?.track('event');
    expect(ldClientMock.track).toHaveBeenCalledTimes(1);

    resetLDMocks();
    expect(ldClientMock.track).toHaveBeenCalledTimes(0);
  });

  test('mock boolean flag correctly', () => {
    mockFlags({ 'bool-flag': true });
    expect(ldClientMock.boolVariation).toBeDefined();
  });

  test('mock number flag correctly', () => {
    mockFlags({ 'number-flag': 42 });
    expect(ldClientMock.numberVariation).toBeDefined();
  });

  test('mock string flag correctly', () => {
    mockFlags({ 'string-flag': 'hello' });
    expect(ldClientMock.stringVariation).toBeDefined();
  });

  test('mock json flag correctly', () => {
    mockFlags({ 'json-flag': { key: 'value' } });
    expect(ldClientMock.jsonVariation).toBeDefined();
  });

  test('mock LDProvider correctly', () => {
    expect(mockLDProvider).toBeDefined();
  });

  test('mock ReactNativeLDClient correctly', () => {
    expect(mockReactNativeLDClient).toBeDefined();
  });

  test('mock ldClient correctly', () => {
    const current = mockUseLDClient();

    current?.track('event');
    expect(ldClientMock.track).toHaveBeenCalledTimes(1);
  });

  test('mock ldClient complete set of methods correctly', () => {
    expect(ldClientMock.identify).toBeDefined();
    expect(ldClientMock.allFlags.mock).toBeDefined();
    expect(ldClientMock.close.mock).toBeDefined();
    expect(ldClientMock.flush).toBeDefined();
    expect(ldClientMock.getContext.mock).toBeDefined();
    expect(ldClientMock.off.mock).toBeDefined();
    expect(ldClientMock.on.mock).toBeDefined();
    expect(ldClientMock.track.mock).toBeDefined();
    expect(ldClientMock.variation.mock).toBeDefined();
    expect(ldClientMock.variationDetail.mock).toBeDefined();
  });
});
