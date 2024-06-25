/* eslint-disable max-classes-per-file */
import { BrowserTelemetry } from '../../api/BrowserTelemetry';
import { Collector } from '../../api/Collector';
import ContinuousReplay from './ContinuousReplay';
import applyPatches from './patches';
import RollingReplay from './RollingReplay';
import { ContinuousCapture, RollingCapture, SessionReplayOptions } from './SessionReplayOptions';

function isRollingCapture(capture: unknown): capture is RollingCapture {
  return (capture as { type: string })?.type === 'rolling';
}

function isContinuousCapture(capture: unknown): capture is ContinuousCapture {
  return (capture as { type: string })?.type === 'continuous';
}

/**
 * Experimental capture of sessions using rrweb.
 */
export default class SessionReplay implements Collector {
  impl: Collector;

  constructor(options?: SessionReplayOptions) {
    applyPatches();
    if (isContinuousCapture(options?.capture)) {
      this.impl = new ContinuousReplay(options.capture);
    } else if (isRollingCapture(options?.capture)) {
      this.impl = new RollingReplay(options.capture);
    } else {
      this.impl = new ContinuousReplay({
        type: 'continuous',
        intervalMs: 5 * 1000,
      });
    }
  }

  register(telemetry: BrowserTelemetry): void {
    this.impl.register(telemetry);
  }

  unregister(): void {
    this.impl.unregister();
  }
}
