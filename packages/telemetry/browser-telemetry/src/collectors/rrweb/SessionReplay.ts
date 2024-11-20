import { type LDContext, type LDEvaluationDetail } from 'launchdarkly-js-client-sdk';
import * as rrweb from 'rrweb';

import { Recorder } from '../../api';
import { Collector } from '../../api/Collector';
import ContinuousReplay from './ContinuousReplay';
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
    const captureOptions = options?.capture;
    if (isContinuousCapture(captureOptions)) {
      this.impl = new ContinuousReplay(captureOptions);
    } else if (isRollingCapture(captureOptions)) {
      this.impl = new RollingReplay(captureOptions);
    } else {
      this.impl = new ContinuousReplay({
        type: 'continuous',
        intervalMs: 5 * 1000,
      });
    }
  }

  register(recorder: Recorder, sessionId: string): void {
    this.impl.register(recorder, sessionId);
  }

  unregister(): void {
    this.impl.unregister();
  }

  handleFlagUsed?(flagKey: string, flagDetail: LDEvaluationDetail, _context: LDContext): void {
    rrweb.record.addCustomEvent('flag-used', { key: flagKey, detail: flagDetail });
  }

  handleFlagDetailChanged?(flagKey: string, detail: LDEvaluationDetail): void {
    rrweb.record.addCustomEvent('flag-detail-changed', { key: flagKey, detail });
  }

  handleErrorEvent(name: string, message: string): void {
    rrweb.record.addCustomEvent('error', { name, message });
  }
}
