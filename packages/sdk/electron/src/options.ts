import type { LDLogger, LDOptions as NodeOptions } from '@launchdarkly/node-client-sdk';

import type { ElectronOptions } from './ElectronOptions';

/**
 * The subset of validated options that stay Electron-only and are never passed to
 * `node-client-sdk`.
 */
export interface ElectronOnlyOptions {
  enableIPC: boolean;
  namespace?: string;
}

function warnWrongType(
  logger: LDLogger,
  key: string,
  expectedType: string,
  actual: unknown,
): void {
  logger.warn(
    `Config option "${key}" should be of type ${expectedType}, got ${typeof actual}, using default value`,
  );
}

/**
 * Validates the Electron-only options and maps `ElectronOptions` onto `NodeOptions`.
 *
 * - `enableIPC`, `useClientSideId`, and `namespace` are validated here (node-client-sdk does not
 *   know about them) and stripped from the produced node options so node-client-sdk does not warn
 *   about unknown configuration.
 * - `useClientSideId` is mapped to node-client-sdk's inverted `useMobileKey`.
 * - `wrapperName`/`wrapperVersion` default to `@launchdarkly/electron-client-sdk` and this
 *   package's version (unless the caller explicitly supplies their own), so node-client-sdk
 *   reports this SDK as a wrapper rather than attributing usage to raw node-client-sdk.
 * - Every other option (tlsParams, enableEventCompression, initialConnectionMode, plugins, hash,
 *   storage, localStoragePath, applicationInfo, sendEvents, debug, logger, maxCachedContexts, ...)
 *   is passed straight through and validated by node-client-sdk.
 */
export function validateAndMapOptions(
  opts: ElectronOptions,
  logger: LDLogger,
): { nodeOptions: NodeOptions; electron: ElectronOnlyOptions } {
  let enableIPC = true;
  if (opts.enableIPC !== undefined) {
    if (typeof opts.enableIPC === 'boolean') {
      enableIPC = opts.enableIPC;
    } else {
      warnWrongType(logger, 'enableIPC', 'boolean', opts.enableIPC);
    }
  }

  let useClientSideId = false;
  if (opts.useClientSideId !== undefined) {
    if (typeof opts.useClientSideId === 'boolean') {
      useClientSideId = opts.useClientSideId;
    } else {
      warnWrongType(logger, 'useClientSideId', 'boolean', opts.useClientSideId);
    }
  }

  let namespace: string | undefined;
  if (opts.namespace !== undefined) {
    if (typeof opts.namespace === 'string') {
      namespace = opts.namespace;
    } else {
      warnWrongType(logger, 'namespace', 'string', opts.namespace);
    }
  }

  // Strip the Electron-only keys and map useClientSideId -> useMobileKey.
  const {
    enableIPC: _enableIPC,
    useClientSideId: _useClientSideId,
    namespace: _namespace,
    ...rest
  } = opts;

  const nodeOptions: NodeOptions = {
    ...rest,
    useMobileKey: !useClientSideId,
    wrapperName: opts.wrapperName ?? '@launchdarkly/electron-client-sdk',
    wrapperVersion: opts.wrapperVersion ?? '0.0.1', // x-release-please-version
  };

  return { nodeOptions, electron: { enableIPC, namespace } };
}
