import {
  LDFlagSet,
  LDProvider,
  ReactNativeLDClient,
  useLDClient,
} from '@launchdarkly/react-native-client-sdk';

jest.mock('@launchdarkly/react-native-client-sdk', () => ({
  LDProvider: jest.fn(),
  ReactNativeLDClient: jest.fn(),
  useLDClient: jest.fn(),
}));

const mockLDProvider = LDProvider as jest.Mock;
const mockReactNativeLDClient = ReactNativeLDClient as jest.Mock;
const mockUseLDClient = useLDClient as jest.Mock;

export const ldClientMock = {
  allFlags: jest.fn(),
  boolVariation: jest.fn(),
  boolVariationDetail: jest.fn(),
  close: jest.fn(),
  flush: jest.fn(() => Promise.resolve()),
  getConnectionMode: jest.fn(),
  getContext: jest.fn(),
  identify: jest.fn(() => Promise.resolve()),
  jsonVariation: jest.fn(),
  jsonVariationDetail: jest.fn(),
  logger: jest.fn(),
  numberVariation: jest.fn(),
  numberVariationDetail: jest.fn(),
  off: jest.fn(),
  on: jest.fn(),
  setConnectionMode: jest.fn(),
  stringVariation: jest.fn(),
  stringVariationDetail: jest.fn(),
  track: jest.fn(),
  variation: jest.fn(),
  variationDetail: jest.fn(),
};

mockLDProvider.mockImplementation((props: any) => props.children);
mockUseLDClient.mockImplementation(() => ldClientMock);
mockReactNativeLDClient.mockImplementation(() => ldClientMock);

export { mockLDProvider, mockReactNativeLDClient, mockUseLDClient };

export const mockFlags = (flags: LDFlagSet) => {
  ldClientMock.boolVariation.mockImplementation((flagKey: string) => {
    if (typeof flags[flagKey] !== 'boolean') {
      throw new Error(`Flag ${flagKey} is not a boolean. Flag value, ${flags[flagKey]}`);
    }
    return flags[flagKey] as boolean;
  });
  ldClientMock.numberVariation.mockImplementation((flagKey: string) => {
    if (typeof flags[flagKey] !== 'number') {
      throw new Error(`Flag ${flagKey} is not a number. Flag value, ${flags[flagKey]}`);
    }
    return flags[flagKey] as number;
  });
  ldClientMock.stringVariation.mockImplementation((flagKey: string) => {
    if (typeof flags[flagKey] !== 'string') {
      throw new Error(`Flag ${flagKey} is not a string. Flag value, ${flags[flagKey]}`);
    }
    return flags[flagKey] as string;
  });
  ldClientMock.jsonVariation.mockImplementation((flagKey: string) => {
    if (typeof flags[flagKey] !== 'object') {
      throw new Error(`Flag ${flagKey} is not a JSON. Flag value, ${flags[flagKey]}`);
    }
    return flags[flagKey] as object;
  });
};
