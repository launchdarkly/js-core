import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

export interface LDProxyOptions {
  host?: string;
  port?: number;
  scheme?: string;
  auth?: string;
}

export interface LDTLSOptions {
  ca?: string | string[] | Buffer | Buffer[];
  cert?: string | string[] | Buffer | Buffer[];
  checkServerIdentity?: (servername: string, cert: any) => Error | undefined;
  ciphers?: string;
  pfx?: string | string[] | Buffer | Buffer[] | object[];
  key?: string | string[] | Buffer | Buffer[] | object[];
  passphrase?: string;
  rejectUnauthorized?: boolean;
  secureProtocol?: string;
  servername?: string;
}

export interface NodeOptions {
  proxyOptions?: LDProxyOptions;
  tlsParams?: LDTLSOptions;
  enableEventCompression?: boolean;
  localStoragePath?: string;
  logger?: LDLogger;
}
