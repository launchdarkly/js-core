import { createOptions, defaultOptions } from '../../src/utils/createOptions';

describe('create options', () => {
  it('returns default options', () => {
    const options = createOptions({});
    expect(options).toEqual(defaultOptions);
  });

  it('should overwrite stream option', () => {
    const options = createOptions({ stream: true });
    expect(options.stream).toBe(true);
  });

  it('logger should be called', () => {
    const mockDebugger = jest.fn();
    const mockLogger: any = { debug: mockDebugger };

    createOptions({ logger: mockLogger });
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
