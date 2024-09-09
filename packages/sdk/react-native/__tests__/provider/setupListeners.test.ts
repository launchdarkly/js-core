import { AutoEnvAttributes } from '@launchdarkly/js-client-sdk-common';

import setupListeners from '../../src/provider/setupListeners';
import ReactNativeLDClient from '../../src/ReactNativeLDClient';

import resetAllMocks = jest.resetAllMocks;

jest.mock('../../src/ReactNativeLDClient');

describe('setupListeners', () => {
  let ldc: ReactNativeLDClient;
  let mockSetState: jest.Mock;

  beforeEach(() => {
    mockSetState = jest.fn();
    ldc = new ReactNativeLDClient('mob-test-key', AutoEnvAttributes.Enabled);
  });

  afterEach(() => resetAllMocks());

  test('change listener is setup', () => {
    setupListeners(ldc, mockSetState);
    expect(ldc.on).toHaveBeenCalledWith('change', expect.any(Function));
  });

  test('client is set on change event', () => {
    setupListeners(ldc, mockSetState);

    const changeHandler = (ldc.on as jest.Mock).mock.calls[0][1];
    changeHandler();

    expect(mockSetState).toHaveBeenCalledWith({ client: ldc });
  });
});
