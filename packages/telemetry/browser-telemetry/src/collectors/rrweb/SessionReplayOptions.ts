export interface RollingCapture {
  type: 'rolling';
  eventSegmentLength: number;
  segmentBufferLength: number;
}

export interface ContinuousCapture {
  type: 'continuous';
  intervalMs: number;
}

export interface SessionReplayOptions {
  capture?: RollingCapture | ContinuousCapture;
}
