import { LDLogger } from '@launchdarkly/js-sdk-common';

import { validateModeDefinition } from '../../src/datasource/ConnectionModeConfig';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

describe('given a valid mode definition', () => {
  it('passes through a valid streaming-like mode definition unchanged', () => {
    const input = {
      initializers: [{ type: 'cache' }, { type: 'polling' }],
      synchronizers: [{ type: 'streaming' }, { type: 'polling' }],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through a valid polling entry with pollInterval', () => {
    const input = {
      initializers: [{ type: 'cache' }],
      synchronizers: [{ type: 'polling', pollInterval: 3600 }],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through a valid streaming entry with initialReconnectDelay', () => {
    const input = {
      initializers: [],
      synchronizers: [{ type: 'streaming', initialReconnectDelay: 5 }],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through endpoint overrides on polling entries', () => {
    const input = {
      initializers: [],
      synchronizers: [
        { type: 'polling', endpoints: { pollingBaseUri: 'https://relay.example.com' } },
      ],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('passes through endpoint overrides on streaming entries', () => {
    const input = {
      initializers: [],
      synchronizers: [
        { type: 'streaming', endpoints: { streamingBaseUri: 'https://stream.example.com' } },
      ],
    };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('treats empty initializers and synchronizers as valid', () => {
    const input = { initializers: [], synchronizers: [] };

    const result = validateModeDefinition(input, 'testMode', logger);

    expect(result).toEqual(input);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given a non-object mode definition', () => {
  it('returns undefined and warns for null', () => {
    const result = validateModeDefinition(null, 'testMode', logger);

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('"testMode"'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('object'));
  });

  it('returns undefined and warns for a string', () => {
    const result = validateModeDefinition('streaming', 'testMode', logger);

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got string'));
  });

  it('returns undefined and warns for a number', () => {
    const result = validateModeDefinition(42, 'testMode', logger);

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('got number'));
  });

  it('returns undefined for undefined', () => {
    const result = validateModeDefinition(undefined, 'testMode', logger);

    expect(result).toBeUndefined();
  });
});

describe('given non-array initializers or synchronizers', () => {
  it('replaces non-array initializers with empty array and warns', () => {
    const result = validateModeDefinition(
      { initializers: 'cache', synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"testMode.initializers" should be of type array'),
    );
  });

  it('replaces non-array synchronizers with empty array and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: { type: 'polling' } },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"testMode.synchronizers" should be of type array'),
    );
  });

  it('defaults missing initializers to empty array', () => {
    const result = validateModeDefinition({ synchronizers: [] }, 'testMode', logger);

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('defaults missing synchronizers to empty array', () => {
    const result = validateModeDefinition({ initializers: [] }, 'testMode', logger);

    expect(result?.synchronizers).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('given entries with invalid type field', () => {
  it('discards an entry with a misspelled type and warns', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 'cace' }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unknown value "cace"'),
    );
  });

  it('discards an entry where type is a number', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 123 }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('should be of type string'));
  });

  it('discards an entry where type is missing', () => {
    const result = validateModeDefinition(
      { initializers: [{ pollInterval: 30 }], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('should be of type string'));
  });

  it('discards null entries', () => {
    const result = validateModeDefinition(
      { initializers: [null], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('discards string entries', () => {
    const result = validateModeDefinition(
      { initializers: ['cache'], synchronizers: [] },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('keeps valid entries and discards invalid ones', () => {
    const result = validateModeDefinition(
      {
        initializers: [{ type: 'cache' }, { type: 'invalid' }, { type: 'polling' }],
        synchronizers: [],
      },
      'testMode',
      logger,
    );

    expect(result?.initializers).toEqual([{ type: 'cache' }, { type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('given polling entries with invalid config', () => {
  it('drops pollInterval when it is a string and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', pollInterval: '30' }] },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('pollInterval'),
    );
  });

  it('drops pollInterval when it is zero', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', pollInterval: 0 }] },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });

  it('drops pollInterval when it is negative', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', pollInterval: -10 }] },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollInterval'));
  });
});

describe('given streaming entries with invalid config', () => {
  it('drops initialReconnectDelay when it is a string and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'streaming', initialReconnectDelay: 'fast' }] },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'streaming' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialReconnectDelay'));
  });

  it('drops initialReconnectDelay when it is negative', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'streaming', initialReconnectDelay: -1 }] },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'streaming' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('initialReconnectDelay'));
  });
});

describe('given entries with invalid endpoint config', () => {
  it('discards endpoints when it is not an object and warns', () => {
    const result = validateModeDefinition(
      { initializers: [], synchronizers: [{ type: 'polling', endpoints: 'https://example.com' }] },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('endpoints'));
  });

  it('discards pollingBaseUri when it is not a string', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [{ type: 'polling', endpoints: { pollingBaseUri: 123 } }],
      },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'polling' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('pollingBaseUri'));
  });

  it('discards streamingBaseUri when it is not a string', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [{ type: 'streaming', endpoints: { streamingBaseUri: true } }],
      },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([{ type: 'streaming' }]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('streamingBaseUri'));
  });

  it('keeps valid endpoint fields and discards invalid ones', () => {
    const result = validateModeDefinition(
      {
        initializers: [],
        synchronizers: [
          {
            type: 'polling',
            endpoints: {
              pollingBaseUri: 'https://relay.example.com',
              streamingBaseUri: 42,
            },
          },
        ],
      },
      'testMode',
      logger,
    );

    expect(result?.synchronizers).toEqual([
      { type: 'polling', endpoints: { pollingBaseUri: 'https://relay.example.com' } },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('streamingBaseUri'));
  });
});

describe('given no logger', () => {
  it('validates without throwing when logger is undefined', () => {
    const result = validateModeDefinition(
      { initializers: [{ type: 'invalid' }], synchronizers: 'bad' },
      'testMode',
    );

    expect(result?.initializers).toEqual([]);
    expect(result?.synchronizers).toEqual([]);
  });
});
