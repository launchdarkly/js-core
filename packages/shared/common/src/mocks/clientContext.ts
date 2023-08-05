import { createSafeLogger } from '../logging';
import { ClientContext } from '../options';
import basicPlatform from './platform';

const clientContext = new ClientContext(
  'testSdkKey',
  { serviceEndpoints: { streaming: '', polling: '', events: '' }, logger: createSafeLogger() },
  basicPlatform,
);

export default clientContext;
