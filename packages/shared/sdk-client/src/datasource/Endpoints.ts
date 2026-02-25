import { base64UrlEncode, Encoding } from '@launchdarkly/js-sdk-common';

import { DataSourcePaths } from './DataSourceConfig';

export interface DataSourceEndpoints {
  polling: () => DataSourcePaths;
  streaming: () => DataSourcePaths;
}

/**
 * Creates endpoint paths for browser (client-side ID) FDv1 evaluation.
 *
 * @param clientSideId The client-side ID for this environment.
 */
export function browserFdv1Endpoints(clientSideId: string): DataSourceEndpoints {
  return {
    polling: () => ({
      pathGet(encoding: Encoding, plainContextString: string): string {
        return `/sdk/evalx/${clientSideId}/contexts/${base64UrlEncode(plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/sdk/evalx/${clientSideId}/context`;
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        throw new Error('Ping for polling unsupported.');
      },
    }),
    streaming: () => ({
      pathGet(encoding: Encoding, plainContextString: string): string {
        return `/eval/${clientSideId}/${base64UrlEncode(plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/eval/${clientSideId}`;
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        return `/ping/${clientSideId}`;
      },
    }),
  };
}

/**
 * Creates endpoint paths for mobile (mobile key) FDv1 evaluation.
 */
export function mobileFdv1Endpoints(): DataSourceEndpoints {
  return {
    polling: () => ({
      pathGet(encoding: Encoding, plainContextString: string): string {
        return `/msdk/evalx/contexts/${base64UrlEncode(plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/msdk/evalx/context`;
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        throw new Error('Ping for polling unsupported.');
      },
    }),
    streaming: () => ({
      pathGet(encoding: Encoding, plainContextString: string): string {
        return `/meval/${base64UrlEncode(plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/meval`;
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        return `/mping`;
      },
    }),
  };
}

/**
 * Creates endpoint paths for FDv2 evaluation.
 * Unified for all client-side platforms per CSFDV2 Requirement 2.1.1.
 */
export function fdv2Endpoints(): DataSourceEndpoints {
  return {
    polling: () => ({
      pathGet(encoding: Encoding, plainContextString: string): string {
        return `/sdk/poll/eval/${base64UrlEncode(plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/sdk/poll/eval`;
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        throw new Error('Ping for polling unsupported.');
      },
    }),
    streaming: () => ({
      pathGet(encoding: Encoding, plainContextString: string): string {
        return `/sdk/stream/eval/${base64UrlEncode(plainContextString, encoding)}`;
      },
      pathReport(_encoding: Encoding, _plainContextString: string): string {
        return `/sdk/stream/eval`;
      },
      pathPing(_encoding: Encoding, _plainContextString: string): string {
        throw new Error('Ping for streaming unsupported.');
      },
    }),
  };
}
