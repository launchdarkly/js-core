const Ldlogger = require('launchdarkly-node-server-sdk/loggers');
const cf = require('./cloudflare_feature_store');
const messages = require('./messages');
const PACKAGE_JSON = require('./package.json');

module.exports = (function () {
  const defaults = function () {
    return {
      stream: false,
      sendEvents: false,
      offline: false,
      useLdd: true,
      allAttributesPrivate: false,
      privateAttributeNames: [],
      inlineUsersInEvents: false,
      userKeysCapacity: 1000,
      userKeysFlushInterval: 300,
      diagnosticOptOut: true,
      diagnosticRecordingInterval: 900,
      wrapperName: 'cloudflare',
      wrapperVersion: PACKAGE_JSON.version,
    };
  };

  const allowedOptions = ['logger', 'featureStore'];

  const validate = function (kvNamespace, sdkKey, options) {
    if (!sdkKey) {
      throw new Error(messages.missingKey());
    }

    if (!kvNamespace || typeof kvNamespace !== 'object' || !!kvNamespace.get === false) {
      throw new Error(messages.missingNamespace());
    }

    Object.entries(options).forEach(([key]) => {
      if (!allowedOptions.includes(key)) {
        throw new Error(messages.unsupportedOption(key));
      }
    });

    const config = Object.assign({}, options || {});

    const fallbackLogger = Ldlogger.basicLogger({ level: 'info' });
    config.logger = config.logger
      ? Ldlogger.safeLogger(config.logger, fallbackLogger)
      : fallbackLogger;

    if (!config.featureStore) {
      config.featureStore = cf.CloudflareFeatureStore(kvNamespace, sdkKey, {}, config.logger);
    }

    const defaultConfig = defaults();

    const retConfig = applyDefaults(config, defaultConfig);
    config.logger.debug(`Using Configuration: ${JSON.stringify(retConfig)}`);

    return retConfig;
  };

  function applyDefaults(config, defaults) {
    // This works differently from Object.assign() in that it will *not* override a default value
    // if the provided value is explicitly set to null.
    const ret = Object.assign({}, config);
    Object.keys(defaults).forEach((name) => {
      if (ret[name] === undefined || ret[name] === null) {
        ret[name] = defaults[name];
      }
    });
    return ret;
  }

  return {
    validate: validate,
    defaults: defaults,
  };
})();
