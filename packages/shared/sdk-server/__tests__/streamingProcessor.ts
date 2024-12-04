import type {
  ClientContext,
  EventName,
  internal,
  LDHeaders,
  LDStreamingError,
  ProcessStreamResponse,
  StreamingErrorHandler,
} from '@launchdarkly/js-sdk-common';

export const MockStreamingProcessor = jest.fn();

export const setupMockStreamingProcessor = (
  shouldError: boolean = false,
  putResponseJson: any = { data: { flags: {}, segments: {} } },
  patchResponseJson?: any,
  deleteResponseJson?: any,
  errorTimeoutSeconds: number = 0,
  initTimeoutMs: number = 0,
) => {
  let initTimeoutHandle: any;
  let patchTimeoutHandle: any;
  let deleteTimeoutHandle: any;

  MockStreamingProcessor.mockImplementation(
    (
      clientContext: ClientContext,
      streamUriPath: string,
      parameters: { key: string; value: string }[],
      listeners: Map<EventName, ProcessStreamResponse>,
      baseHeaders: LDHeaders,
      diagnosticsManager: internal.DiagnosticsManager,
      errorHandler: StreamingErrorHandler,
      _streamInitialReconnectDelay: number,
    ) => ({
      start: jest.fn(async () => {
        if (shouldError) {
          initTimeoutHandle = setTimeout(() => {
            const unauthorized = new Error('test-error') as LDStreamingError;
            // @ts-ignore
            unauthorized.code = 401;
            errorHandler(unauthorized);
          }, errorTimeoutSeconds * 1000);
        } else {
          // execute put which will resolve the identify promise
          initTimeoutHandle = setTimeout(() => {
            listeners.get('put')?.processJson(putResponseJson);
          }, initTimeoutMs);

          if (patchResponseJson) {
            patchTimeoutHandle = setTimeout(() =>
              listeners.get('patch')?.processJson(patchResponseJson),
            );
          }

          if (deleteResponseJson) {
            deleteTimeoutHandle = setTimeout(() =>
              listeners.get('delete')?.processJson(deleteResponseJson),
            );
          }
        }
      }),
      close: jest.fn(() => {
        clearTimeout(initTimeoutHandle);
        clearTimeout(patchTimeoutHandle);
        clearTimeout(deleteTimeoutHandle);
      }),
      eventSource: {},
    }),
  );
};
