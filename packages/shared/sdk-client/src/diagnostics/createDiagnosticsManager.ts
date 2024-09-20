import { internal, Platform } from '@launchdarkly/js-sdk-common';

import ConfigurationImpl from '../configuration';
import createDiagnosticsInitConfig from './createDiagnosticsInitConfig';

const createDiagnosticsManager = (
  clientSideID: string,
  config: ConfigurationImpl,
  platform: Platform,
) => {
  if (config.sendEvents && !config.diagnosticOptOut) {
    return new internal.DiagnosticsManager(
      clientSideID,
      platform,
      createDiagnosticsInitConfig(config),
    );
  }

  return undefined;
};

export default createDiagnosticsManager;
