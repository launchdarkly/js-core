import { EdgeProvider } from '@launchdarkly/akamai-edgeworker-sdk-common';

import { EdgeKV } from './edgekv';

type EdgeKVProviderParams = {
  namespace: string;
  group: string;
};

export default class EdgeKVProvider implements EdgeProvider {
  private _edgeKv: EdgeKV;

  constructor({ namespace, group }: EdgeKVProviderParams) {
    this._edgeKv = new EdgeKV({ namespace, group } as any);
  }

  async get(rootKey: string): Promise<string | null | undefined> {
    try {
      return await this._edgeKv.getText({ item: rootKey } as any);
    } catch (e) {
      /* empty */
    }
    return undefined;
  }
}
