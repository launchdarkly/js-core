import { render } from '@testing-library/react';

import { AutoEnvAttributes, LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import { useLDClient } from '../hooks';
import ReactNativeLDClient from '../ReactNativeLDClient';
import LDProvider from './LDProvider';
import setupListeners from './setupListeners';

jest.mock('./setupListeners');
jest.mock('../ReactNativeLDClient');

const TestApp = () => {
  const ldClient = useLDClient();
  return (
    <>
      <p>ldClient {ldClient ? 'defined' : 'undefined'}</p>
      <p>mobileKey {ldClient.sdkKey ? ldClient.sdkKey : 'undefined'}</p>
      <p>context {ldClient.getContext() ? 'defined' : 'undefined'}</p>
    </>
  );
};
describe('LDProvider', () => {
  let ldc: ReactNativeLDClient;
  let context: LDContext;
  const mockSetupListeners = setupListeners as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    (ReactNativeLDClient as jest.Mock).mockImplementation(
      (mobileKey: string, autoEnvAttributes: AutoEnvAttributes, _options?: LDOptions) => {
        let internalCachedContext: LDContext;

        return {
          sdkKey: mobileKey,
          autoEnvAttributes,
          identify: jest.fn((c: LDContext) => {
            internalCachedContext = c;
            return Promise.resolve();
          }),
          getContext: jest.fn(() => internalCachedContext),
          on: jest.fn(),
          logger: {
            debug: jest.fn(),
          },
        };
      },
    );
    mockSetupListeners.mockImplementation((client: ReactNativeLDClient, setState: any) => {
      setState({ client });
    });
    ldc = new ReactNativeLDClient('mobile-key', AutoEnvAttributes.Enabled);
    context = { kind: 'user', key: 'test-user-key-1' };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('client is correctly set', () => {
    const { getByText } = render(
      <LDProvider client={ldc}>
        <TestApp />
      </LDProvider>,
    );

    expect(getByText(/ldclient defined/i)).toBeTruthy();
    expect(getByText(/mobilekey mobile-key/i)).toBeTruthy();
    expect(getByText(/context undefined/i)).toBeTruthy();
  });

  test('specified context is identified', async () => {
    const { getByText } = render(
      <LDProvider client={ldc} context={context}>
        <TestApp />
      </LDProvider>,
    );

    expect(mockSetupListeners).toHaveBeenCalledWith(ldc, expect.any(Function));
    expect(ldc.identify).toHaveBeenCalledWith(context);
    expect(ldc.getContext()).toEqual(context);
    expect(getByText(/context defined/i)).toBeTruthy();
  });

  test('identify errors are caught', async () => {
    (ldc.identify as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('faking error when identifying')),
    );
    render(
      <LDProvider client={ldc} context={context}>
        <TestApp />
      </LDProvider>,
    );
    await jest.runAllTimersAsync();

    expect(ldc.logger.debug).toHaveBeenCalledWith(expect.stringMatching(/identify error/));
  });
});
