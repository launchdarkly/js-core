import * as http from 'http';
import * as https from 'https';
import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent';
import { format as formatUrl } from 'url';
import { promisify } from 'util';
import * as zlib from 'zlib';

import { createEventSource } from '@launchdarkly/eventsource';
import {
  EventSourceCapabilities,
  LDLogger,
  LDProxyOptions,
  LDTLSOptions,
  platform,
} from '@launchdarkly/js-server-sdk-common';

import NodeResponse from './NodeResponse';
import NodeStreamingResponse from './NodeStreamingResponse';

const gzip = promisify(zlib.gzip);

/**
 * The TLS options that are copied onto each streaming `https` request. The names match the
 * options of `https.request()`.
 */
const TLS_OPTION_NAMES = [
  'pfx',
  'key',
  'passphrase',
  'cert',
  'ca',
  'ciphers',
  'rejectUnauthorized',
  'secureProtocol',
  'servername',
  'checkServerIdentity',
] as const;

function tlsRequestOptions(tlsOptions?: LDTLSOptions): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  if (!tlsOptions) {
    return merged;
  }
  const bag = tlsOptions as unknown as Record<string, unknown>;
  TLS_OPTION_NAMES.forEach((name) => {
    if (bag[name] !== undefined) {
      merged[name] = bag[name];
    }
  });
  return merged;
}

function processTlsOptions(tlsOptions: LDTLSOptions): https.AgentOptions {
  const options: https.AgentOptions & { [index: string]: any } = {
    ca: tlsOptions.ca,
    cert: tlsOptions.cert,
    checkServerIdentity: tlsOptions.checkServerIdentity,
    ciphers: tlsOptions.ciphers,
    // Our interface says object for the pfx object. But the node
    // type is more strict. This is also true for the key and KeyObject.
    // @ts-ignore
    pfx: tlsOptions.pfx,
    // @ts-ignore
    key: tlsOptions.key,
    passphrase: tlsOptions.passphrase,
    rejectUnauthorized: tlsOptions.rejectUnauthorized,
    secureProtocol: tlsOptions.secureProtocol,
    servername: tlsOptions.servername,
  };

  // Node does not take kindly to undefined keys.
  Object.keys(options).forEach((key) => {
    if (options[key] === undefined) {
      delete options[key];
    }
  });

  return options;
}

function processProxyOptions(
  proxyOptions: LDProxyOptions,
  additional: https.AgentOptions = {},
): https.Agent | http.Agent {
  const proxyUrl = formatUrl({
    protocol: proxyOptions.scheme?.startsWith('https') ? 'https:' : 'http:',
    slashes: true,
    hostname: proxyOptions.host,
    port: proxyOptions.port,
  });
  const parsedOptions: HttpsProxyAgentOptions<string> = {
    ...additional,
  };
  if (proxyOptions.auth) {
    parsedOptions.headers = {
      'Proxy-Authorization': `Basic ${Buffer.from(proxyOptions.auth).toString('base64')}`,
    };
  }

  // Node does not take kindly to undefined keys.
  Object.keys(parsedOptions).forEach((key) => {
    if (parsedOptions[key as keyof HttpsProxyAgentOptions<string>] === undefined) {
      delete parsedOptions[key as keyof HttpsProxyAgentOptions<string>];
    }
  });

  return new HttpsProxyAgent(proxyUrl, parsedOptions);
}

function createAgent(
  tlsOptions?: LDTLSOptions,
  proxyOptions?: LDProxyOptions,
  logger?: LDLogger,
): https.Agent | http.Agent | undefined {
  if (!proxyOptions?.auth?.startsWith('https') && tlsOptions) {
    logger?.warn('Proxy configured with TLS options, but is not using an https auth.');
  }
  if (tlsOptions) {
    const agentOptions = processTlsOptions(tlsOptions);
    if (proxyOptions) {
      return processProxyOptions(proxyOptions, agentOptions);
    }
    return new https.Agent(agentOptions);
  }
  if (proxyOptions) {
    return processProxyOptions(proxyOptions);
  }
  return undefined;
}

// A caller-supplied agent is a completely different way of constructing the agent than the
// tlsOptions/proxyOptions path above: it takes precedence and is used verbatim, covering proxy
// schemes the SDK does not build itself (for example a SOCKS proxy via socks-proxy-agent). When
// it is set, proxyOptions and tlsParams are ignored because the agent owns connection setup.
function resolveAgent(
  tlsOptions?: LDTLSOptions,
  proxyOptions?: LDProxyOptions,
  proxyAgent?: https.Agent | http.Agent,
  logger?: LDLogger,
): https.Agent | http.Agent | undefined {
  if (proxyAgent) {
    if (proxyOptions || tlsOptions) {
      logger?.warn(
        'Both proxyAgent and proxyOptions/tlsParams were provided; using proxyAgent and ignoring proxyOptions/tlsParams.',
      );
    }
    return proxyAgent;
  }
  return createAgent(tlsOptions, proxyOptions, logger);
}

export default class NodeRequests implements platform.Requests {
  private _agent: https.Agent | http.Agent | undefined;

  private _tlsParams: Record<string, unknown>;

  private _hasProxy: boolean = false;

  private _hasProxyAuth: boolean = false;

  private _enableBodyCompression: boolean = false;

  constructor(
    tlsOptions?: LDTLSOptions,
    proxyOptions?: LDProxyOptions,
    proxyAgent?: https.Agent | http.Agent,
    logger?: LDLogger,
    enableEventCompression?: boolean,
  ) {
    this._agent = resolveAgent(tlsOptions, proxyOptions, proxyAgent, logger);
    // The agent owns connection setup when the caller supplies one, so the per-request TLS
    // parameters are only forwarded when this class built the agent itself (or no agent exists).
    this._tlsParams = tlsRequestOptions(proxyAgent ? undefined : tlsOptions);
    // A caller-supplied proxyAgent is treated as a best-effort proxy signal: the SDK cannot
    // inspect an opaque agent to know whether it actually proxies (it could just as easily be a
    // certificate-only agent for mTLS). Reporting true is the better default here because
    // proxying is this option's primary motivation, while other connection concerns (such as
    // custom TLS) are handled by tlsParams.
    this._hasProxy = !!proxyOptions || !!proxyAgent;
    // Same best-effort reasoning as _hasProxy above: the SDK can't inspect a caller-supplied
    // proxyAgent to know whether it carries its own auth (e.g. credentials embedded in a SOCKS
    // URL), so treat any proxyAgent as a best-effort signal for auth too, rather than reporting
    // false just because it doesn't come from proxyOptions.auth.
    this._hasProxyAuth = !!proxyOptions?.auth || !!proxyAgent;
    this._enableBodyCompression = !!enableEventCompression;
  }

  async fetch(url: string, options: platform.Options = {}): Promise<platform.Response> {
    if (options.streaming) {
      return this._streamingFetch(url, options);
    }
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;

    const headers = { ...options.headers };
    let bodyData: string | Buffer | undefined = options.body;

    // For get requests we are going to automatically support compressed responses.
    // Note this does not affect SSE as streaming requests take the branch above.
    if (options.method?.toLowerCase() === 'get') {
      headers['accept-encoding'] = 'gzip';
    }
    // For post requests we are going to support compressed post bodies if the
    // enableEventCompression config setting is true and the compressBodyIfPossible
    // option is true.
    else if (
      this._enableBodyCompression &&
      !!options.compressBodyIfPossible &&
      options.method?.toLowerCase() === 'post' &&
      options.body
    ) {
      headers['content-encoding'] = 'gzip';
      bodyData = await gzip(Buffer.from(options.body, 'utf8'));
    }

    return new Promise((resolve, reject) => {
      const req = impl.request(
        url,
        {
          timeout: options.timeout,
          headers,
          method: options.method,
          agent: this._agent,
        },
        (res) => resolve(new NodeResponse(res)),
      );

      if (bodyData) {
        req.write(bodyData);
      }

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });

      req.end();
    });
  }

  /**
   * The transport for a streaming request. It does not request compressed content, and it never
   * follows a redirect. A redirect status resolves like any other non-200 response, and the
   * caller decides whether to retry the original URL. It applies no read or socket timeout. The
   * caller owns the read timeout and cancels through the abort signal.
   */
  private _streamingFetch(url: string, options: platform.Options): Promise<platform.Response> {
    const isSecure = url.startsWith('https://');
    const impl = isSecure ? https : http;
    const requestOptions: https.RequestOptions & Record<string, unknown> = {
      method: options.method,
      headers: options.headers,
      agent: this._agent,
    };
    if (isSecure) {
      Object.assign(requestOptions, this._tlsParams);
    }
    return new Promise<platform.Response>((resolve, reject) => {
      const req = impl.request(url, requestOptions, (res) =>
        resolve(new NodeStreamingResponse(res)),
      );
      // An SSE consumer wants each chunk as soon as it arrives; do not batch small writes.
      req.setNoDelay(true);
      const { signal } = options;
      if (signal) {
        const abort = () => req.destroy(new Error('The stream request was aborted'));
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener('abort', abort, { once: true });
        }
      }
      // This listener stays attached after resolve. A later socket error then becomes a harmless
      // no-op reject instead of an unhandled 'error' event that would crash the process
      req.on('error', reject);
      if (options.body !== undefined) {
        req.write(options.body);
      }
      req.end();
    });
  }

  createEventSource(
    url: string,
    eventSourceInitDict: platform.EventSourceInitDict,
  ): platform.EventSource {
    return createEventSource(url, {
      ...eventSourceInitDict,
      maxBackoffMillis: 30 * 1000,
      jitterRatio: 0.5,
      fetch: (fetchUrl, init) => this.fetch(fetchUrl, { ...init, streaming: true }),
    });
  }

  getEventSourceCapabilities(): EventSourceCapabilities {
    return {
      readTimeout: true,
      headers: true,
      customMethod: true,
    };
  }

  usingProxy(): boolean {
    return this._hasProxy;
  }

  usingProxyAuth(): boolean {
    return this._hasProxyAuth;
  }
}
