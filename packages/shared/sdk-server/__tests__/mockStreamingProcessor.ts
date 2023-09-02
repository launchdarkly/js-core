import {
  ClientContext,
  EventName,
  internal,
  LDStreamingError,
  ProcessStreamResponse,
} from '@launchdarkly/js-sdk-common';

jest.mock('@launchdarkly/js-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-sdk-common');

  return {
    ...actual,
    ...{ internal: { ...actual.internal, StreamingProcessor: jest.fn() } },
  };
});

export const mockStreamingProcessor = internal.StreamingProcessor as jest.Mock;

export const setupMockStreamingProcessor = (shouldError: boolean = false) => {
  mockStreamingProcessor.mockImplementation(
    (
      sdkKey: string,
      clientContext: ClientContext,
      listeners: Map<EventName, ProcessStreamResponse>,
      diagnosticsManager: internal.DiagnosticsManager,
      errorHandler: internal.StreamingErrorHandler,
    ) => ({
      start: jest.fn(async () => {
        if (shouldError) {
          process.nextTick(() => errorHandler(new LDStreamingError('test-error', 401)));
        } else {
          // execute put which will resolve the init promise
          listeners.get('put')?.processJson({ data: { flags: {}, segments: {} } });
        }
      }),
      close: jest.fn(),
    }),
  );
};
