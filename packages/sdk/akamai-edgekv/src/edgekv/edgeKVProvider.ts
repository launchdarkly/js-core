import { EdgeProvider } from '@launchdarkly/akamai-edgeworker-sdk-common';

import { EdgeKV } from './edgekv';

type EdgeKVProviderParams = {
  namespace: string;
  group: string;
};

export default class EdgeKVProvider implements EdgeProvider {
  private edgeKv: EdgeKV;

  constructor({ namespace, group }: EdgeKVProviderParams) {
    this.edgeKv = new EdgeKV({ namespace, group } as any);
  }

  async get(rootKey: string): Promise<string | null | undefined> {
    try {
      return await this.edgeKv.getText({ item: rootKey } as any);
    } catch (e) {
      /* empty */
    }
    return undefined;
  }
}
