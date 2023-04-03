const ldClient = (kvNamespace: string, sdkKey: string) => {
  const testOutput = `kv=${kvNamespace}; sdkKey=${sdkKey};`;
  console.log(`============== ${testOutput}`);
  return testOutput;
  // const config = configuration.validate(kvNamespace, sdkKey, originalConfig);
  // const ldClient = ld.init('none', config);
  // const client = {};
  //
  // client.variation = function (key, user, defaultValue, callback) {
  //   return ldClient.variation(key, user, defaultValue, callback);
  // };
  //
  // client.variationDetail = function (key, user, defaultValue, callback) {
  //   return ldClient.variationDetail(key, user, defaultValue, callback);
  // };
  //
  // client.allFlagsState = function (user, options, callback) {
  //   return ldClient.allFlagsState(user, options, callback);
  // };
  //
  // client.waitForInitialization = function () {
  //   return ldClient.waitForInitialization();
  // };
  //
  // return client;
};

export default ldClient;
