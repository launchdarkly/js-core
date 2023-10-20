import { LDClientImpl } from '@launchdarkly/js-client-sdk-common';
import platform from './platform';
const init = async (sdkKey, context, options = {}) => {
    const ldc = new LDClientImpl(sdkKey, context, platform, options);
    await ldc.start();
    return ldc;
};
export * from '@launchdarkly/js-client-sdk-common';
export default init;
