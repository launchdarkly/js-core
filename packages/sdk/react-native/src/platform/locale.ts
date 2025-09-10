import { NativeModules, Platform } from 'react-native';
/**
 * Apps opted into Fabric (the new architecture of React Native) 
 * may not have access to the SettingsManager.settings.AppleLocale property.
 * It is now common to use the `getConstants` method to access these constant properties with Fabric enabled apps.
 */
const getAppleLocale = () => {
  const settings = NativeModules.SettingsManager?.settings ?? NativeModules.SettingsManager?.getConstants()?.settings;
  return settings?.AppleLocale;
}

export default Platform.select({
    ios: getAppleLocale(),
    android: NativeModules.I18nManager?.localeIdentifier,
})
