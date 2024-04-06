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
            const unauthorized = new Error('test-error') as LDStreamingError;
            // @ts-ignore
            unauthorized.code = 401;
            errorHandler(unauthorized);
          }, errorTimeoutSeconds * 1000);
        } else {
          // execute put which will resolve the identify promise
          setTimeout(() => listeners.get('put')?.processJson(putResponseJson));

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
