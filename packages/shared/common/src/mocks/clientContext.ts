import { ClientContext } from '../options';
import basicPlatform from './platform';

const clientContext = new ClientContext(
  'testSdkKey',
  { serviceEndpoints: { streaming: '', polling: '', events: '' } },
  basicPlatform,
);

export default clientContext;
