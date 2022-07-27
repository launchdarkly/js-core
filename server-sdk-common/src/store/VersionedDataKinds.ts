import { DataKind } from '../api/interfaces';
import { Flag } from '../evaluation/data/Flag';

export interface VersionedDataKind extends DataKind {
  namespace: string,
  streamApiPath: string,
  requestPath: string,
  getDependencyKeys?: (item: any) => string[]
}

export default class VersionedDataKinds {
  static readonly Features: VersionedDataKind = {
    namespace: 'features',
    streamApiPath: '/flags/',
    requestPath: '/sdk/latest-flags/',
  };

  static readonly Segments: VersionedDataKind = {
    namespace: 'segments',
    streamApiPath: '/segments/',
    requestPath: '/sdk/latest-segments/',
  };
}
