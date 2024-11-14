import { EdgeProvider } from '@launchdarkly/akamai-edgeworker-sdk-common';
import { LDLogger } from '@launchdarkly/js-server-sdk-common';

import { EdgeKV } from './edgekv';

type EdgeKVProviderParams = {
  namespace: string;
  group: string;
  logger: LDLogger;
};

export default class EdgeKVProvider implements EdgeProvider {
  private _edgeKv: EdgeKV;
  private _logger: LDLogger;

  constructor({ namespace, group, logger }: EdgeKVProviderParams) {
    this._edgeKv = new EdgeKV({ namespace, group } as any);
    this._logger = logger;
  }

  async get(rootKey: string): Promise<string | null | undefined> {
    try {
      return await this._edgeKv.getText({ item: rootKey } as any);
    } catch (e) {
      this._logger?.error(`Error getting value from EdgeKV: ${e}`);
    }
    return undefined;
  }
}
