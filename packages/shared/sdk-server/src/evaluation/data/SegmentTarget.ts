export interface SegmentTarget {
  contextKind: string;
  values: string[];
  // When there are a large number of values we put them into a set.
  // This set is generated during deserialization, and changed back to a list
  // during serialization.
  generated_valuesSet?: Set<string>;
}
