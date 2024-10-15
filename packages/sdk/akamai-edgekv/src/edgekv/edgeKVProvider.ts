import { BasicLogger, EdgeProvider } from '@launchdarkly/js-server-sdk-common';

import { EdgeKV } from './edgekv';

type EdgeKVProviderParams = {
  namespace: string;
  group: string;
  logger: BasicLogger;
};

export default class EdgeKVProvider implements EdgeProvider {
  private edgeKv: EdgeKV;
  private logger: BasicLogger;

  constructor({ namespace, group, logger }: EdgeKVProviderParams) {
    this.edgeKv = new EdgeKV({ namespace, group } as any);
    this.logger = logger;
  }

  async get(rootKey: string): Promise<string | null | undefined> {
    try {
      return await this.edgeKv.getText({ item: rootKey } as any);
    } catch (e) {
      this.logger?.error(`Error getting value from EdgeKV: ${e}`);
    }
    return undefined;
  }
}
