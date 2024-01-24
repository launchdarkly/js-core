import { setupClientContext } from './clientContext';
import { setupBasicPlatform } from './platform';

beforeAll(() => {
  setupBasicPlatform();
  setupClientContext();
});

beforeEach(() => {
  setupBasicPlatform();
  setupClientContext();
});
