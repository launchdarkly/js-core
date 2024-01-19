jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.NativeModules.SettingsManager = {
    settings: {
      AppleLocale: 'en-us',
    },
  };

  // HACK: force set Platform which is read-only
  Object.defineProperty(RN.Platform, 'Version', {
    get: () => 21,
  });

  return RN;
});
