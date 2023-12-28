import { render } from '@testing-library/react';

import { useLDClient } from '../hooks';
import ReactNativeLDClient from '../ReactNativeLDClient';
import LDProvider from './LDProvider';

const TestApp = () => {
  const ldClient = useLDClient();
  return (
    <>
      <p>ldClient {ldClient ? 'defined' : 'undefined'}</p>
      <p>context {ldClient.getContext() ? 'defined' : 'undefined'}</p>
    </>
  );
};
describe('LDProvider', () => {
  let ldc: ReactNativeLDClient;

  beforeEach(() => {
    ldc = new ReactNativeLDClient('mob-test', { sendEvents: false });
  });

  test('correctly pass LDClient to children', () => {
    const { getByText } = render(
      <LDProvider client={ldc}>
        <TestApp />
      </LDProvider>,
    );

    expect(getByText(/ldclient defined/i)).toBeTruthy();
    expect(getByText(/context undefined/i)).toBeTruthy();
  });

  test.todo('specified context is identified');
  test.todo('listeners are setup correctly');
});
