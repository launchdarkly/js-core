import { renderHook } from '@testing-library/react';
import React, { useRef } from 'react';
import { AppState } from 'react-native';

import { AutoEnvAttributes, debounce } from '@launchdarkly/js-client-sdk-common';
import { logger } from '@launchdarkly/private-js-mocks';

import EventSource from '../fromExternal/react-native-sse';
import ReactNativeLDClient from '../ReactNativeLDClient';
import useAppState from './useAppState';

jest.mock('@launchdarkly/js-client-sdk-common', () => {
  const actual = jest.requireActual('@launchdarkly/js-client-sdk-common');
  return {
    ...actual,
    debounce: jest.fn(),
  };
});

describe('useAppState', () => {
  const eventSourceOpen = 1;
  const eventSourceClosed = 2;

  let appStateSpy: jest.SpyInstance;
  let ldc: ReactNativeLDClient;
  let mockEventSource: Partial<EventSource>;

  beforeEach(() => {
    (debounce as jest.Mock).mockImplementation((f) => f);
    appStateSpy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    jest.spyOn(React, 'useRef').mockReturnValue({
      current: 'active',
    });

    ldc = new ReactNativeLDClient('mob-test-key', AutoEnvAttributes.Enabled, { logger });

    mockEventSource = {
      getStatus: jest.fn(() => eventSourceOpen),
      OPEN: eventSourceOpen,
      CLOSED: eventSourceClosed,
    };
    // @ts-ignore
    ldc.platform.requests = { eventSource: mockEventSource };
    // @ts-ignore
    ldc.streamer = { start: jest.fn().mockName('start'), stop: jest.fn().mockName('stop') };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('stops streamer in background', () => {
    renderHook(() => useAppState(ldc));
    const onChange = appStateSpy.mock.calls[0][1];

    onChange('background');

    expect(ldc.streamer?.stop).toHaveBeenCalledTimes(1);
  });

  test('starts streamer transitioning from background to active', () => {
    (useRef as jest.Mock).mockReturnValue({ current: 'background' });
    (mockEventSource.getStatus as jest.Mock).mockReturnValue(eventSourceClosed);

    renderHook(() => useAppState(ldc));
    const onChange = appStateSpy.mock.calls[0][1];

    onChange('active');

    expect(ldc.streamer?.start).toHaveBeenCalledTimes(1);
    expect(ldc.streamer?.stop).not.toHaveBeenCalled();
  });

  test('starts streamer transitioning from inactive to active', () => {
    (useRef as jest.Mock).mockReturnValue({ current: 'inactive' });
    (mockEventSource.getStatus as jest.Mock).mockReturnValue(eventSourceClosed);

    renderHook(() => useAppState(ldc));
    const onChange = appStateSpy.mock.calls[0][1];

    onChange('active');

    expect(ldc.streamer?.start).toHaveBeenCalledTimes(1);
    expect(ldc.streamer?.stop).not.toHaveBeenCalled();
  });

  test('does not start streamer in foreground because event source is already open', () => {
    (useRef as jest.Mock).mockReturnValue({ current: 'background' });
    (mockEventSource.getStatus as jest.Mock).mockReturnValue(eventSourceOpen);

    renderHook(() => useAppState(ldc));
    const onChange = appStateSpy.mock.calls[0][1];

    onChange('active');

    expect(ldc.streamer?.start).not.toHaveBeenCalled();
    expect(ldc.streamer?.stop).not.toHaveBeenCalled();
    expect(ldc.logger.debug).toHaveBeenCalledWith(expect.stringMatching(/already open/));
  });

  test('active state unchanged no action needed', () => {
    (useRef as jest.Mock).mockReturnValue({ current: 'active' });
    (mockEventSource.getStatus as jest.Mock).mockReturnValue(eventSourceClosed);

    renderHook(() => useAppState(ldc));
    const onChange = appStateSpy.mock.calls[0][1];

    onChange('active');

    expect(ldc.streamer?.start).not.toHaveBeenCalled();
    expect(ldc.streamer?.stop).not.toHaveBeenCalled();
    expect(ldc.logger.debug).toHaveBeenCalledWith(expect.stringMatching(/no action needed/i));
  });
});
