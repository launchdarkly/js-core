import Configuration from './Configuration';
import { getDefaults } from './defaultsAndValidators';

describe('Configuration', () => {
  let config: Configuration;
  const defaults = getDefaults();

  beforeEach(() => {
    jest.resetAllMocks();
    config = new Configuration();
  });

  test('empty options', () => {
    // TODO: do we really need a tribool for stream? We need to simplify the complex
    // logic of setting up streams and if anyone really cares about it so much.
    expect(config).toEqual({ ...defaults, stream: false });
  });

  test('specified options', () => {
    config = new Configuration({ stream: true });
    expect(config).toEqual({ ...defaults, stream: true });
  });

  test('wrong type', () => {
    // todo:
  });
});
