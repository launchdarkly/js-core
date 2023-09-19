import { DataKind } from '../api/interfaces';

export interface VersionedDataKind extends DataKind {
  namespace: string;
  streamApiPath: string;
  requestPath: string;
  getDependencyKeys?: (item: any) => string[];
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

  static getKeyFromPath(kind: VersionedDataKind, path: string): string | undefined {
    return path.startsWith(kind.streamApiPath)
      ? path.substring(kind.streamApiPath.length)
      : undefined;
  }
}
