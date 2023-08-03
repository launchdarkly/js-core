import { Versioned } from '../evaluation/data/Versioned';

export interface Metric extends Versioned {
  samplingRatio?: number;
}
