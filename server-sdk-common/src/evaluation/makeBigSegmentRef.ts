import { Segment } from './data/Segment';

/**
 * @internal
 */
export default function makeBigSegmentRef(segment: Segment): string {
  // The format of Big Segment references is independent of what store implementation is being
  // used; the store implementation receives only this string and does not know the details of
  // the data model. The Relay Proxy will use the same format when writing to the store.
  return `${segment.key}.g${segment.generation}`;
}
