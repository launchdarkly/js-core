import { setupBasicPlatform } from './platform';

export default function setupMocks() {
  beforeEach(() => {
    setupBasicPlatform();
  });
}
