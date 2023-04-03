const CachingStoreWrapper = require('launchdarkly-node-server-sdk/caching_store_wrapper');
const noop = function () {};

const defaultCacheTTLSeconds = 60;

const kvStore = function CloudflareFeatureStore(kvNamespace, sdkKey, options, logger) {
  let ttl = options && options.cacheTTL;
  if (ttl === null || ttl === undefined) {
    ttl = defaultCacheTTLSeconds;
  }

  return (config) =>
    new CachingStoreWrapper(
      cfFeatureStoreInternal(kvNamespace, sdkKey, logger || config.logger),
      ttl,
      'Cloudflare'
    );
};

function cfFeatureStoreInternal(kvNamespace, sdkKey, logger) {
  const key = `LD-Env-${sdkKey}`;
  const store = {};

  store.getInternal = (kind, flagKey, maybeCallback) => {
    logger.debug(`Requesting key: ${flagKey} from KV.`);
    const cb = maybeCallback || noop;
    kvNamespace
      .get(key, { type: 'json' })
      .then((item) => {
        if (item === null) {
          logger.error('Feature data not found in KV.');
        }
        const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
        cb(item[kindKey][flagKey]);
      })
      .catch((err) => {
        logger.error(err);
      });
  };

  store.getAllInternal = (kind, maybeCallback) => {
    const cb = maybeCallback || noop;
    const kindKey = kind.namespace === 'features' ? 'flags' : kind.namespace;
    logger.debug(`Requesting all ${kindKey} data from KV.`);
    kvNamespace
      .get(key, { type: 'json' })
      .then((item) => {
        if (item === null) {
          logger.error('Feature data not found in KV.');
        }
        cb(item[kindKey]);
      })
      .catch((err) => {
        logger.error(err);
      });
  };

  store.initInternal = (allData, cb) => {
    cb && cb();
  };

  store.upsertInternal = noop;

  store.initializedInternal = (maybeCallback) => {
    const cb = maybeCallback || noop;
    kvNamespace.get(key).then((item) => cb(Boolean(item === null)));
  };

  // KV Binding is done outside of the application logic.
  store.close = noop;

  return store;
}

module.exports = {
  CloudflareFeatureStore: kvStore,
};
