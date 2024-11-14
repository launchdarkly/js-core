/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react-native';

import { mockFlags, resetLDMocks } from '@launchdarkly/jest/react-native';
import { useLDClient } from '@launchdarkly/react-native-client-sdk';

import Welcome from './welcome';

describe('Welcome component test', () => {
  afterEach(() => {
    resetLDMocks();
  });

  test('mock boolean flag correctly', () => {
    mockFlags({ 'my-boolean-flag': true });
    render(<Welcome />);
    expect(screen.getByText('Flag value is true')).toBeTruthy();
  });

  test('mock ldClient correctly', () => {
    const current = useLDClient();

    current?.track('event');
    expect(current.track).toHaveBeenCalledTimes(1);
  });
});
