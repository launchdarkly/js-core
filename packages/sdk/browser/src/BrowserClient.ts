import { AutoEnvAttributes, LDClient as CommonClient, ConnectionMode, LDClientImpl, LDContext, LDEvaluationDetail, LDEvaluationDetailTyped, LDFlagSet, LDFlagValue, LDLogger, LDOptions } from '@launchdarkly/js-client-sdk-common';
import { LDIdentifyOptions } from '@launchdarkly/js-client-sdk-common/dist/api/LDIdentifyOptions';
import BrowserPlatform from './platform/BrowserPlatform';

/**
 * We are not supporting dynamically setting the connection mode on the LDClient.
 */
export type LDClient = Omit<CommonClient, 'setConnectionMode'>;


export class BrowserClient extends LDClientImpl {
  constructor(clientSideId: string, autoEnvAttributes: AutoEnvAttributes, options: LDOptions = {}){
    super(clientSideId, autoEnvAttributes, new BrowserPlatform(options))
  }
}
