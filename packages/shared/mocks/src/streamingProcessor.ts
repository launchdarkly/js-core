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
  errorTimeoutSeconds: number = 0,
  shouldPut: boolean = true,
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
          setTimeout(() => {
            const unauthorized: LDStreamingError = {
              code: 401,
              name: 'LaunchDarklyStreamingError',
              message: 'test-error',
            };
            errorHandler(unauthorized);
          }, errorTimeoutSeconds * 1000);
        } else {
          // execute put which will resolve the identify promise
          if (shouldPut) {
            setTimeout(() => listeners.get('put')?.processJson(putResponseJson));
          }

          if (patchResponseJson) {
            setTimeout(() => listeners.get('patch')?.processJson(patchResponseJson));
          }

          if (deleteResponseJson) {
            setTimeout(() => listeners.get('delete')?.processJson(deleteResponseJson));
          }
        }
      }),
      close: jest.fn(),
      eventSource: {},
    }),
  );
};
