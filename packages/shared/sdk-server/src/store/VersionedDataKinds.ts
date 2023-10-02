import { DataKind } from '../api/interfaces';

export interface VersionedDataKind extends DataKind {
  namespace: string;
  streamApiPath: string;
  getDependencyKeys?: (item: any) => string[];
}

export default class VersionedDataKinds {
  static readonly Features: VersionedDataKind = {
    namespace: 'features',
    streamApiPath: '/flags/',
  };

  static readonly Segments: VersionedDataKind = {
    namespace: 'segments',
    streamApiPath: '/segments/',
  };
}
