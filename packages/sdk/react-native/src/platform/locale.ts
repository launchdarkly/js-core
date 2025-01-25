import { NativeModules, Platform } from 'react-native';

/**
 * Ripped from:
 * https://dev.to/medaimane/localization-and-internationalization-in-react-native-reaching-global-audiences-3acj
 */
const locale =
  Platform.OS === 'ios'
    ? NativeModules.SettingsManager?.settings?.AppleLocale // iOS
    : NativeModules.I18nManager?.localeIdentifier;

export default locale;
