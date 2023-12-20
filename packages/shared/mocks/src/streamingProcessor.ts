import type {
  ClientContext,
  EventName,
  internal,
  LDStreamingError,
  ProcessStreamResponse,
} from '@common';

export const MockStreamingProcessor = jest.fn();

export const setupMockStreamingProcessor = (
  shouldError: boolean = false,
  putResponseJson: any = { data: { flags: {}, segments: {} } },
  patchResponseJson?: any,
  deleteResponseJson?: any,
) => {
  MockStreamingProcessor.mockImplementation(
    (
      sdkKey: string,
      clientContext: ClientContext,
      streamUriPath: string,
      listeners: Map<EventName, ProcessStreamResponse>,
      diagnosticsManager: internal.DiagnosticsManager,
      errorHandler: internal.StreamingErrorHandler,
      _streamInitialReconnectDelay: number,
    ) => ({
      start: jest.fn(async () => {
        if (shouldError) {
          process.nextTick(() => {
            const unauthorized: LDStreamingError = {
              code: 401,
              name: 'LaunchDarklyStreamingError',
              message: 'test-error',
            };
            errorHandler(unauthorized);
          });
        } else {
          // execute put which will resolve the identify promise
          process.nextTick(() => listeners.get('put')?.processJson(putResponseJson));

          if (patchResponseJson) {
            process.nextTick(() => listeners.get('patch')?.processJson(patchResponseJson));
          }

          if (deleteResponseJson) {
            process.nextTick(() => listeners.get('delete')?.processJson(deleteResponseJson));
          }
        }
      }),
      close: jest.fn(),
      eventSource: {},
    }),
  );
};
