import { DataKind } from '../api/interfaces';
import { Flag } from '../evaluation/data/Flag';

export interface VersionedDataKind extends DataKind {
  namespace: string,
  streamApiPath: string,
  requestPath: string,
  priority: number,
  getDependencyKeys?: (item: any) => string[]
}

export default class VersionedDataKinds {
  static readonly Features: VersionedDataKind = {
    namespace: 'features',
    streamApiPath: '/flags/',
    requestPath: '/sdk/latest-flags/',
    priority: 1,
    getDependencyKeys: (flag: Flag) => {
      if (!flag.prerequisites || !flag.prerequisites.length) {
        return [];
      }
      return flag.prerequisites.map((preReq) => preReq.key);
    },
  };

  static readonly Segments: VersionedDataKind = {
    namespace: 'segments',
    streamApiPath: '/segments/',
    requestPath: '/sdk/latest-segments/',
    priority: 0,
  };
}
