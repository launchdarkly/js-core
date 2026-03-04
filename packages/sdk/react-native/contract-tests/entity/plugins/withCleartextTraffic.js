const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    mainApplication.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
