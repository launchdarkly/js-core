import { Breadcrumb, EventData, Recorder, SessionData } from './api';

const CUSTOM_KEY_PREFIX = '$ld:telemetry';
const ERROR_KEY = `${CUSTOM_KEY_PREFIX}:error`;
const SESSION_CAPTURE_KEY = `${CUSTOM_KEY_PREFIX}:sessionCapture`;
const GENERIC_EXCEPTION = 'generic';
const NULL_EXCEPTION_MESSAGE = 'exception was null or undefined';
const MISSING_MESSAGE = 'exception had no message';

export default function defaultRecorder(capture: (data: EventData) => void): Recorder {
  const captureError = (error: Error) => {
    const validException = error !== undefined && error !== null;

    const data: ErrorData = validException
      ? {
          type: error.name || error.constructor?.name || GENERIC_EXCEPTION,
          // Only coalesce null/undefined, not empty.
          message: error.message ?? MISSING_MESSAGE,
          stack: parse(error, this._options.stack),
          breadcrumbs: [...this._breadcrumbs],
          sessionId: this._sessionId,
        }
      : {
          type: GENERIC_EXCEPTION,
          message: NULL_EXCEPTION_MESSAGE,
          stack: { frames: [] },
          breadcrumbs: [...this._breadcrumbs],
          sessionId: this._sessionId,
        };
    capture(ERROR_KEY, data);
  };
  const captureErrorEvent = (error: ErrorEvent) => {};
  const addBreadcrumb = (breadcrumb: Breadcrumb) => {};
  const captureSession = (sessionData: SessionData) => {};

  return {
    captureError,
    captureErrorEvent,
    addBreadcrumb,
    captureSession,
  };
}
