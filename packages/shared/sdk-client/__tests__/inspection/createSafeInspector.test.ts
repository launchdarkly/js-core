import { LDLogger } from '@launchdarkly/js-sdk-common';

import { LDInspectionFlagUsedHandler } from '../../src/api/LDInspection';
import createSafeInspector from '../../src/inspection/createSafeInspector';

describe('given a safe inspector', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const mockInspector: LDInspectionFlagUsedHandler = {
    type: 'flag-used',
    name: 'the-inspector-name',
    method: () => {
      throw new Error('evil inspector');
    },
  };
  const safeInspector = createSafeInspector(mockInspector, logger);

  it('has the correct type', () => {
    expect(safeInspector.type).toEqual('flag-used');
  });

  it('does not allow exceptions to propagate', () => {
    // @ts-ignore Calling with invalid parameters.
    safeInspector.method();
  });

  it('only logs one error', () => {
    // @ts-ignore Calling with invalid parameters.
    safeInspector.method();
    // @ts-ignore Calling with invalid parameters.
    safeInspector.method();
    expect(logger.warn).toHaveBeenCalledWith(
      'an inspector: "the-inspector-name" of type: "flag-used" generated an exception',
    );
  });
});

// Type and name are required by the schema, but it should operate fine if they are not specified.
describe('given a safe inspector with no name or type', () => {
  const logger: LDLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockInspector = {
    method: () => {
      throw new Error('evil inspector');
    },
  };
  // @ts-ignore Allow registering the invalid inspector.
  const safeInspector = createSafeInspector(mockInspector, logger);

  it('has undefined type', () => {
    expect(safeInspector.type).toBeUndefined();
  });

  it('has undefined name', () => {
    expect(safeInspector.name).toBeUndefined();
  });

  it('does not allow exceptions to propagate', () => {
    // @ts-ignore Calling with invalid parameters.
    safeInspector.method();
  });

  it('only logs one error', () => {
    // @ts-ignore Calling with invalid parameters.
    safeInspector.method();
    // @ts-ignore Calling with invalid parameters.
    safeInspector.method();
    expect(logger.warn).toHaveBeenCalledWith(
      'an inspector: "undefined" of type: "undefined" generated an exception',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
