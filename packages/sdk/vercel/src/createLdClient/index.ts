import { EdgeConfigClient } from '@vercel/edge-config';
import { LDOptions } from '@launchdarkly/js-server-sdk-common';
import LDClientVercel from './LDClientVercel';

const createLdClient = (edgeConfig: EdgeConfigClient, sdkKey: string, options: LDOptions = {}) =>
  new LDClientVercel(edgeConfig, sdkKey, options);

export default createLdClient;
