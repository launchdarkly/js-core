/* eslint-disable import/prefer-default-export */
import { registerLD } from '@launchdarkly/react-sdk';

export async function register() {
  registerLD(process.env.LD_SDK_KEY!);
}
