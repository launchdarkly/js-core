/// <reference types="@fastly/js-compute" />
import { basicLogger, init, LDContext, LDLogger, LDOptions } from '../src/index';

// The index module imports the KV store type from the Fastly runtime.
jest.mock('fastly:kv-store');

describe('package exports', () => {
  it('exports a basicLogger factory that returns an LDLogger', () => {
    expect(typeof basicLogger).toBe('function');
    const logger: LDLogger = basicLogger({ level: 'debug' });
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('exports init as a runtime value', () => {
    expect(typeof init).toBe('function');
  });

  it('exports the LDContext and LDOptions types', () => {
    // These assignments only compile when the types are exported.
    const context: LDContext = { kind: 'user', key: 'example-user-key', anonymous: true };
    const options: LDOptions = {
      logger: basicLogger({ level: 'debug' }),
      eventsBackendName: 'launchdarkly',
    };
    expect(context.key).toBe('example-user-key');
    expect(options.eventsBackendName).toBe('launchdarkly');
  });
});
