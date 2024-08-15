import { Flag } from '../types';

/**
 * An item descriptor is an abstraction that allows for Flag data to be
 * handled using the same type in both a put or a patch.
 */
export interface ItemDescriptor {
  version: number;
  flag: Flag;
}
