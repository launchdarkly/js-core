import { render } from '@testing-library/react';

import { AutoEnvAttributes, LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import { useLDClient } from '../hooks';
import ReactLDClient from '../ReactLDClient';
import LDProvider from './LDProvider';
import setupListeners from './setupListeners';

jest.mock('../provider/useAppState');
jest.mock('../ReactLDClient');
jest.mock('./setupListeners');

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
  let ldc: ReactLDClient;
  const mockSetupListeners = setupListeners as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    (ReactLDClient as jest.Mock).mockImplementation(
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
    mockSetupListeners.mockImplementation((client: ReactLDClient, setState: any) => {
      setState({ client });
    });
    ldc = new ReactLDClient('mobile-key', AutoEnvAttributes.Enabled);
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
