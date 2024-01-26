import { AutoEnvAttributes } from '@launchdarkly/js-client-sdk-common';

import ReactNativeLDClient from '../ReactNativeLDClient';
import setupListeners from './setupListeners';

import resetAllMocks = jest.resetAllMocks;

jest.mock('../ReactNativeLDClient');

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
