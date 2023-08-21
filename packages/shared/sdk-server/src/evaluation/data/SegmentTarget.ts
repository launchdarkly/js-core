export interface SegmentTarget {
  contextKind: string;
  values: string[];
  generated_valuesSet?: Set<string>;
}
