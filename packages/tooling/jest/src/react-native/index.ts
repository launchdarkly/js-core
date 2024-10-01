import {
  LDFlagSet,
  LDProvider,
  ReactNativeLDClient,
  useLDClient,
} from '@launchdarkly/react-native-client-sdk';

jest.mock('@launchdarkly/react-native-client-sdk', () => ({
  LDFlagSet: jest.fn(() => ({})),
  LDProvider: jest.fn().mockImplementation(({ children }) => children),
  ReactNativeLDClient: jest.fn().mockImplementation(),
  useLDClient: jest.fn().mockImplementation(),
  useBoolVariation: jest.fn(),
  useBoolVariationDetail: jest.fn(),
  useNumberVariation: jest.fn(),
  useNumberVariationDetail: jest.fn(),
  useStringVariation: jest.fn(),
  useStringVariationDetail: jest.fn(),
  useJsonVariation: jest.fn(),
  useJsonVariationDetail: jest.fn(),
  useTypedVariation: jest.fn(),
  useTypedVariationDetail: jest.fn(),
}));

export const ldClientMock: any = {
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

export const mockLDProvider = LDProvider as jest.Mock;
export const mockReactNativeLDClient = ReactNativeLDClient as jest.Mock;
export const mockUseLDClient = useLDClient as jest.Mock;

mockLDProvider.mockImplementation(({ children }) => children);
mockReactNativeLDClient.mockImplementation(() => ldClientMock);
mockUseLDClient.mockImplementation(() => ldClientMock);

export const mockFlags = (flags: LDFlagSet): any => {
  Object.keys(flags).forEach((key) => {
    const defaultValue = flags[key];
    switch (typeof defaultValue) {
      case 'boolean':
        ldClientMock.boolVariation.mockImplementation(
          (flagKey: string) => flags[flagKey] as boolean,
        );
        break;
      case 'number':
        ldClientMock.numberVariation.mockImplementation(
          (flagKey: string) => flags[flagKey] as number,
        );
        break;
      case 'string':
        ldClientMock.stringVariation.mockImplementation(
          (flagKey: string) => flags[flagKey] as string,
        );
        break;
      case 'object':
        ldClientMock.jsonVariation.mockImplementation(
          (flagKey: string) => flags[flagKey] as object,
        );
        break;
      default:
        break;
    }
  });
};

export const resetLDMocks = () => {
  jest.clearAllMocks();
};
