import app from './index';
import testData from './testData.json';

describe('test', () => {
  let env: Bindings;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    // solves jest complaining about console.log in flush after exiting
    // eslint-disable-next-line no-console
    console.log = jest.fn();

    mockExecutionContext = {
      waitUntil: jest.fn(),
      passThroughOnException: jest.fn(),
    };
    env = getMiniflareBindings();
    const { LD_KV } = env;
    await LD_KV.put('LD-Env-test-client-side-id', JSON.stringify(testData));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('variation true', async () => {
    const res = await app.fetch(
      new Request('http://localhost/?email=truemail'),
      env,
      mockExecutionContext,
    );
    expect(await res.text()).toContain('testFlag1: true');
  });

  test('variation false', async () => {
    const res = await app.fetch(
      new Request('http://localhost/?email=falsemail'),
      env,
      mockExecutionContext,
    );
    expect(await res.text()).toContain('testFlag1: false');
  });
});
