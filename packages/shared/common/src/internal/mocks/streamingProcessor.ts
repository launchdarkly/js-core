import { EventName, ProcessStreamResponse } from '../../api';
import { LDStreamingError } from '../../errors';
import { ClientContext } from '../../options';
import { DiagnosticsManager } from '../diagnostics';
import { type StreamingErrorHandler } from '../stream';
import j from './getJest';

export const MockStreamingProcessor = j.fn();

export const setupMockStreamingProcessor = (shouldError: boolean = false) => {
  MockStreamingProcessor.mockImplementation(
    (
      sdkKey: string,
      clientContext: ClientContext,
      listeners: Map<EventName, ProcessStreamResponse>,
      diagnosticsManager: DiagnosticsManager,
      errorHandler: StreamingErrorHandler,
      __streamInitialReconnectDelay: number,
    ) => ({
      start: jest.fn(async () => {
        if (shouldError) {
          process.nextTick(() => errorHandler(new LDStreamingError('test-error', 401)));
        } else {
          // execute put which will resolve the init promise
          process.nextTick(
            () => listeners.get('put')?.processJson({ data: { flags: {}, segments: {} } }),
          );
        }
      }),
      close: jest.fn(),
    }),
  );
};
