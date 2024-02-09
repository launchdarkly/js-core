import { NativeModules, Platform } from 'react-native';

/**
 * Ripped from:
 * https://dev.to/medaimane/localization-and-internationalization-in-react-native-reaching-global-audiences-3acj
 */
const locale =
  Platform.OS === 'ios'
    ? NativeModules.SettingsManager.settings.AppleLocale // iOS
    : NativeModules.I18nManager?.localeIdentifier; // Android and rest

// eslint-disable-next-line import/no-mutable-exports
// let locale: string | undefined;
//
// if (Platform.OS === 'ios') {
//   locale = NativeModules.SettingsManager.settings.AppleLocale;
// } else if (NativeModules.I18nManager) {
//   locale = NativeModules.I18nManager.localeIdentifier;
// } else {
//   // can't get locale, return undefined
//   locale = undefined;
// }

export default locale;
