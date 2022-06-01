import { DataKind } from '../api/interfaces';

export interface VersionedDataKind extends DataKind {
  namespace: string,
  streamApiPath: string,
  requestPath: string,
  priority: number,
}

export default class VersionedDataKinds {
  static readonly Features: VersionedDataKind = {
    namespace: 'features',
    streamApiPath: '/flags/',
    requestPath: '/sdk/latest-flags/',
    priority: 1,
  };

  static readonly Segments: VersionedDataKind = {
    namespace: 'segments',
    streamApiPath: '/segments/',
    requestPath: '/sdk/latest-segments/',
    priority: 0,
  };
}
