/// <reference types="@fastly/js-compute" />
import { BasicLogger, init, LDContext, LDLogger, LDOptions } from '../src/index';

// The index module imports the KV store type from the Fastly runtime.
jest.mock('fastly:kv-store');

describe('package exports', () => {
  it('exports BasicLogger as a runtime value', () => {
    expect(typeof BasicLogger).toBe('function');
    const logger: LDLogger = new BasicLogger({ level: 'debug' });
    expect(typeof logger.debug).toBe('function');
  });

  it('exports init as a runtime value', () => {
    expect(typeof init).toBe('function');
  });

  it('exports the LDContext and LDOptions types', () => {
    // These assignments only compile when the types are exported.
    const context: LDContext = { kind: 'user', key: 'example-user-key', anonymous: true };
    const options: LDOptions = {
      logger: new BasicLogger({ level: 'debug' }),
      eventsBackendName: 'launchdarkly',
    };
    expect(context.key).toBe('example-user-key');
    expect(options.eventsBackendName).toBe('launchdarkly');
  });
});
