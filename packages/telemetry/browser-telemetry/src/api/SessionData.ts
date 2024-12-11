import type { eventWithTime } from '@rrweb/types';

export interface SessionData {
  events: eventWithTime[];
  index: number;
}
