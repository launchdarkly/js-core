import Configuration from './Configuration';
import { getDefaults } from './defaultsAndValidators';

describe('Configuration', () => {
  const defaults = getDefaults();

  beforeEach(() => {
    jest.resetAllMocks();
    console.error = jest.fn();
  });

  test('defaults', () => {
    const config = new Configuration();
    expect(config).toEqual(defaults);
  });

  test('warnings should be logged when unspecified options are assigned defaults', () => {
    const config = new Configuration();

    expect(console.error).toHaveBeenCalledTimes(6);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('"stream" should be of type boolean | undefined | null'),
    );
    expect(console.error).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"wrapperName" should be of type string'),
    );
    expect(console.error).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('"wrapperVersion" should be of type string'),
    );
    expect(console.error).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('"application" should be of type object'),
    );
    expect(console.error).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('"bootstrap" should be of type object'),
    );
    expect(console.error).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('"requestHeaderTransform" should be of type function'),
    );
  });

  test('specified options should be set', () => {
    const config = new Configuration({ stream: true });
    expect(config).toEqual({ ...defaults, stream: true });
  });

  test('minimum should be set', () => {
    const config = new Configuration({ flushInterval: 1 });

    expect(config.flushInterval).toEqual(2000);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        '"flushInterval" had invalid value of 1, using minimum of 2000 instead',
      ),
    );
  });
});
