import { render } from '@testing-library/react';

import { AutoEnvAttributes, LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import { useLDClient } from '../../src/hooks';
import LDProvider from '../../src/provider/LDProvider';
import setupListeners from '../../src/provider/setupListeners';
import ReactNativeLDClient from '../../src/ReactNativeLDClient';

jest.mock('../../src/ReactNativeLDClient');
jest.mock('../../src/provider/setupListeners');

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
});
