import { ClientContext, internal, subsystem } from '@launchdarkly/js-sdk-common';

export const MockEventProcessor = jest.fn();

export const setupMockEventProcessor = () => {
  MockEventProcessor.mockImplementation(
    (
      _config: internal.EventProcessorOptions,
      _clientContext: ClientContext,
      _contextDeduplicator?: subsystem.LDContextDeduplicator,
      _diagnosticsManager?: internal.DiagnosticsManager,
      _start: boolean = true,
    ) => ({
      close: jest.fn(),
      flush: jest.fn(),
      sendEvent: jest.fn(),
    }),
  );
};
