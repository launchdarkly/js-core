/**
 * The return type of [[BigSegmentStore.getUserMembership]], describing which Big Segments a
 * specific user is included in or excluded from.
 *
 * This object may be cached by the SDK, so it should not be modified after it is created. It
 * is a snapshot of the segment membership state at one point in time.
 */
export interface BigSegmentStoreMembership {
  /**
   * Each property key in this object is a "segment reference", which is how segments are
   * identified in Big Segment data. This string is not identical to the segment key-- the SDK
   * will add other information. The store implementation should not be concerned with the
   * format of the string.
   *
   * A true value means that the user is explicitly included in the segment. A false value
   * means that the user is explicitly excluded from the segment-- and is not also explicitly
   * included (that is, if both an include and an exclude existed in the data, the include would
   * take precedence). If the user's status in a particular segment is undefined, there should
   * be no key or value for that segment.
   */
  [segmentRef: string]: boolean;
}
