import { Encoding } from '@launchdarkly/js-sdk-common';

import {
  browserFdv1Endpoints,
  fdv2Endpoints,
  mobileFdv1Endpoints,
} from '../../src/datasource/Endpoints';

// Simple mock encoding that makes base64url behavior visible in assertions.
// btoa returns 'ENCODED:<input>' so tests can verify the raw context string was passed through.
const mockEncoding: Encoding = {
  btoa: (s: string) => `ENCODED:${s}`,
};

describe('browserFdv1Endpoints', () => {
  const clientSideId = 'client-side-id-123';
  const endpoints = browserFdv1Endpoints(clientSideId);
  const ctx = '{"kind":"user","key":"user-1"}';

  it('returns the correct polling GET path with encoded context', () => {
    const paths = endpoints.polling();
    expect(paths.pathGet(mockEncoding, ctx)).toBe(
      `/sdk/evalx/${clientSideId}/contexts/ENCODED:${ctx}`,
    );
  });

  it('returns the correct polling REPORT path', () => {
    const paths = endpoints.polling();
    expect(paths.pathReport(mockEncoding, ctx)).toBe(`/sdk/evalx/${clientSideId}/context`);
  });

  it('throws on polling PING', () => {
    const paths = endpoints.polling();
    expect(() => paths.pathPing(mockEncoding, ctx)).toThrow('Ping for polling unsupported.');
  });

  it('returns the correct streaming GET path with encoded context', () => {
    const paths = endpoints.streaming();
    expect(paths.pathGet(mockEncoding, ctx)).toBe(`/eval/${clientSideId}/ENCODED:${ctx}`);
  });

  it('returns the correct streaming REPORT path', () => {
    const paths = endpoints.streaming();
    expect(paths.pathReport(mockEncoding, ctx)).toBe(`/eval/${clientSideId}`);
  });

  it('returns the correct streaming PING path', () => {
    const paths = endpoints.streaming();
    expect(paths.pathPing(mockEncoding, ctx)).toBe(`/ping/${clientSideId}`);
  });
});

describe('mobileFdv1Endpoints', () => {
  const endpoints = mobileFdv1Endpoints();
  const ctx = '{"kind":"user","key":"user-1"}';

  it('returns the correct polling GET path with encoded context', () => {
    const paths = endpoints.polling();
    expect(paths.pathGet(mockEncoding, ctx)).toBe(`/msdk/evalx/contexts/ENCODED:${ctx}`);
  });

  it('returns the correct polling REPORT path', () => {
    const paths = endpoints.polling();
    expect(paths.pathReport(mockEncoding, ctx)).toBe('/msdk/evalx/context');
  });

  it('throws on polling PING', () => {
    const paths = endpoints.polling();
    expect(() => paths.pathPing(mockEncoding, ctx)).toThrow('Ping for polling unsupported.');
  });

  it('returns the correct streaming GET path with encoded context', () => {
    const paths = endpoints.streaming();
    expect(paths.pathGet(mockEncoding, ctx)).toBe(`/meval/ENCODED:${ctx}`);
  });

  it('returns the correct streaming REPORT path', () => {
    const paths = endpoints.streaming();
    expect(paths.pathReport(mockEncoding, ctx)).toBe('/meval');
  });

  it('returns the correct streaming PING path', () => {
    const paths = endpoints.streaming();
    expect(paths.pathPing(mockEncoding, ctx)).toBe('/mping');
  });
});

describe('fdv2Endpoints', () => {
  const endpoints = fdv2Endpoints();
  const ctx = '{"kind":"user","key":"user-1"}';

  it('returns the correct polling GET path with encoded context', () => {
    const paths = endpoints.polling();
    expect(paths.pathGet(mockEncoding, ctx)).toBe(`/sdk/poll/eval/ENCODED:${ctx}`);
  });

  it('returns the correct polling REPORT path', () => {
    const paths = endpoints.polling();
    expect(paths.pathReport(mockEncoding, ctx)).toBe('/sdk/poll/eval');
  });

  it('throws on polling PING', () => {
    const paths = endpoints.polling();
    expect(() => paths.pathPing(mockEncoding, ctx)).toThrow('Ping for polling unsupported.');
  });

  it('returns the correct streaming GET path with encoded context', () => {
    const paths = endpoints.streaming();
    expect(paths.pathGet(mockEncoding, ctx)).toBe(`/sdk/stream/eval/ENCODED:${ctx}`);
  });

  it('returns the correct streaming REPORT path', () => {
    const paths = endpoints.streaming();
    expect(paths.pathReport(mockEncoding, ctx)).toBe('/sdk/stream/eval');
  });

  it('throws on streaming PING', () => {
    const paths = endpoints.streaming();
    expect(() => paths.pathPing(mockEncoding, ctx)).toThrow('Ping for streaming unsupported.');
  });
});
