import app from '../src/index';
import testData from '../src/testData.json';

const TEST_CLIENT_SIDE_ID = 'test-client-side-id';

// Must match the asciiArt constant in src/index.ts exactly, including
// trailing whitespace, so a corrupted or truncated art block is caught.
const EXPECTED_ASCII_ART = `
        ██       
          ██     
      ████████   
         ███████ 
██ LAUNCHDARKLY █
         ███████ 
      ████████   
          ██     
        ██       
`;

describe('cloudflare example worker', () => {
  let env: Bindings;
  let mockExecutionContext: ExecutionContext;
  let originalFetch: typeof globalThis.fetch;

  beforeAll(() => {
    // flush()'s internal fetch() call fires even with waitUntil mocked, so stub
    // fetch globally here to avoid real requests; each test sets its own response below.
    originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(async () => {
    // avoids jest's complaint about console.log firing after the test has already exited
    console.log = jest.fn();
    // the SDK logs an expected warning when evaluating a flag that is not in
    // the fixture, which would otherwise clutter the test output
    console.error = jest.fn();

    (globalThis.fetch as jest.Mock).mockReset().mockResolvedValue(new Response(null, { status: 202 }));

    // The mock only needs waitUntil for this example, so the unused members of
    // ExecutionContext are not implemented.
    mockExecutionContext = {
      waitUntil: jest.fn(),
      passThroughOnException: jest.fn(),
    } as unknown as ExecutionContext;

    // Must match the clientSideID constant hardcoded in src/index.ts.
    env = getMiniflareBindings();
    const { LD_KV } = env;
    await LD_KV.put(`LD-Env-${TEST_CLIENT_SIDE_ID}`, JSON.stringify(testData));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('reports the flag value and shows the ascii art when the flag is true', async () => {
    const res = await app.fetch(new Request('http://localhost/'), env, mockExecutionContext);
    const body = await res.text();
    expect(body).toContain('The sample-feature feature flag evaluates to true.');
    expect(body).toContain(EXPECTED_ASCII_ART);
    expect(mockExecutionContext.waitUntil).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/events/bulk/${TEST_CLIENT_SIDE_ID}`),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
