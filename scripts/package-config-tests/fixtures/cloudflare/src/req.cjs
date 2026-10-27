const sdk = require('@launchdarkly/cloudflare-server-sdk');
module.exports = { init: sdk.init, keys: Object.keys(sdk).length };
