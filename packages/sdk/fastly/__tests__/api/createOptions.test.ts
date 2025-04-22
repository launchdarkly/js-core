import { BasicLogger } from '@launchdarkly/js-server-sdk-common';

import createOptions, { defaultOptions } from '../../src/api/createOptions';

describe('createOptions', () => {
  test('default options', () => {
    expect(createOptions({})).toEqual(defaultOptions);
  });

  test('override logger', () => {
    const logger = new BasicLogger({ name: 'test' });
    expect(createOptions({ logger })).toEqual({
      ...defaultOptions,
      logger,
    });
  });
});
