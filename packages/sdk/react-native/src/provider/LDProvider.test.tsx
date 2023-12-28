import { act, render } from '@testing-library/react';

import type { LDContext, LDOptions } from '@launchdarkly/js-client-sdk-common';

import { useLDClient } from '../hooks';
import ReactNativeLDClient from '../ReactNativeLDClient';
import LDProvider from './LDProvider';

jest.mock('../ReactNativeLDClient', () =>
  jest.fn((mobileKey: string, _options: LDOptions) => {
    let context: LDContext;

    return {
      sdkKey: mobileKey,
      identify: jest.fn((c: LDContext) => {
        context = c;
        return Promise.resolve();
      }),
      getContext: jest.fn(() => context),
      on: jest.fn(),
    };
  }),
);

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

  beforeEach(() => {
    ldc = new ReactNativeLDClient('mobile-key', { sendEvents: false });
    context = { kind: 'user', key: 'test-user-key-1' };
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

  test.only('specified context is identified', async () => {
    let output;
    await act(async () => {
      output = render(
        <LDProvider client={ldc} context={context}>
          <TestApp />
        </LDProvider>,
      );
    });

    expect(output!.getByText(/context defined/i)).toBeTruthy();
  });

  test.todo('listeners are setup correctly');
});
