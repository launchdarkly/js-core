import { renderHook } from '@testing-library/react-hooks'
import { mockFlags, ldClientMock, mockLDProvider, mockReactNativeLDClient, mockUseLDClient } from "../react-native";

describe('react-native', () => {

  test('mock boolean flag correctly', () => {
    mockFlags({ 'bool-flag': true });
  });

  test('mock number flag correctly', () => {
    mockFlags({ 'number-flag': 42 });
  });

  test('mock string flag correctly', () => {
    mockFlags({ 'string-flag': 'hello' });
  });

  test('mock json flag correctly', () => {
    mockFlags({ 'json-flag': { key: 'value' } });
  });

  test('mock LDProvider correctly', () => {
    expect(mockLDProvider).toBeDefined();
  });

  test('mock ReactNativeLDClient correctly', () => {
    expect(mockReactNativeLDClient).toBeDefined();
  });

  test('mock ldClient correctly', () => {
    const {
      result: { current },
    } = renderHook(() => mockUseLDClient())

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
    expect(ldClientMock.setConnectionMode.mock).toBeDefined();
    expect(ldClientMock.track.mock).toBeDefined();
    expect(ldClientMock.variation.mock).toBeDefined();
    expect(ldClientMock.variationDetail.mock).toBeDefined();
  });
});
