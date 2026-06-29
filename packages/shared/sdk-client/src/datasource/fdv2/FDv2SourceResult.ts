import { DataSourceErrorKind, internal } from '@launchdarkly/js-sdk-common';

import DataSourceStatusErrorInfo from '../DataSourceStatusErrorInfo';

/**
 * Possible states for a status result from an FDv2 data source.
 *
 * - `interrupted`: Transient error; synchronizer will retry automatically.
 * - `shutdown`: Graceful shutdown; no further results will be produced.
 * - `terminal_error`: Unrecoverable error; no further results will be produced.
 * - `goodbye`: Server-initiated disconnect; no further results will be produced.
 */
export type SourceState = 'interrupted' | 'shutdown' | 'terminal_error' | 'goodbye';

/**
 * A successfully processed FDv2 payload ready for delivery to the flag store.
 */
export interface ChangeSetResult {
  type: 'changeSet';
  payload: internal.Payload;
  fdv1Fallback: boolean;
  environmentId?: string;
  /** Freshness timestamp from cache, if this result originated from cached data. */
  freshness?: number;
  /**
   * When `fdv1Fallback` is true, how long (ms) to remain on FDv1 before
   * attempting FDv2 recovery. `undefined` means no TTL was provided (caller
   * uses a default); `0` means indefinite (no recovery). See SDK-2617.
   */
  fdv1FallbackTtlMs?: number;
}

/**
 * A state-transition result (error, shutdown, or goodbye) with no payload.
 */
export interface StatusResult {
  type: 'status';
  state: SourceState;
  errorInfo?: DataSourceStatusErrorInfo;
  reason?: string;
  fdv1Fallback: boolean;
  /**
   * When `fdv1Fallback` is true, how long (ms) to remain on FDv1 before
   * attempting FDv2 recovery. `undefined` means no TTL was provided (caller
   * uses a default); `0` means indefinite (no recovery). See SDK-2617.
   */
  fdv1FallbackTtlMs?: number;
}

/**
 * The result type for FDv2 initializers and synchronizers.
 *
 * Initializers produce a single result; synchronizers produce a stream.
 * The orchestrator in {@link FDv2DataSource} drives the control flow based
 * on which variant is returned.
 */
export type FDv2SourceResult = ChangeSetResult | StatusResult;

/**
 * Wraps a processed FDv2 payload in a {@link ChangeSetResult}.
 */
export function changeSet(
  payload: internal.Payload,
  fdv1Fallback: boolean,
  environmentId?: string,
  freshness?: number,
  fdv1FallbackTtlMs?: number,
): FDv2SourceResult {
  return { type: 'changeSet', payload, fdv1Fallback, environmentId, freshness, fdv1FallbackTtlMs };
}

/**
 * Signals a transient error. Synchronizers retry automatically; for an
 * initializer this is terminal since there is no retry loop.
 */
export function interrupted(
  errorInfo: DataSourceStatusErrorInfo,
  fdv1Fallback: boolean,
  fdv1FallbackTtlMs?: number,
): FDv2SourceResult {
  return { type: 'status', state: 'interrupted', errorInfo, fdv1Fallback, fdv1FallbackTtlMs };
}

/**
 * Signals a graceful close initiated by the local caller (not the server).
 */
export function shutdown(): FDv2SourceResult {
  return { type: 'status', state: 'shutdown', fdv1Fallback: false };
}

/**
 * Signals an unrecoverable error. The orchestrator will block this source
 * and move on; it will not retry.
 */
export function terminalError(
  errorInfo: DataSourceStatusErrorInfo,
  fdv1Fallback: boolean,
  fdv1FallbackTtlMs?: number,
): FDv2SourceResult {
  return { type: 'status', state: 'terminal_error', errorInfo, fdv1Fallback, fdv1FallbackTtlMs };
}

/**
 * Signals a server-initiated disconnect. Unlike terminal_error, this is
 * expected and the synchronizer handles reconnection internally.
 */
export function goodbye(reason: string, fdv1Fallback: boolean): FDv2SourceResult {
  return { type: 'status', state: 'goodbye', reason, fdv1Fallback };
}

/** Builds {@link DataSourceStatusErrorInfo} for an unexpected HTTP status. */
export function errorInfoFromHttpError(statusCode: number): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.ErrorResponse,
    message: `Unexpected status code: ${statusCode}`,
    statusCode,
    time: Date.now(),
  };
}

/** Builds {@link DataSourceStatusErrorInfo} for a network-level failure. */
export function errorInfoFromNetworkError(message: string): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.NetworkError,
    message,
    time: Date.now(),
  };
}

/** Builds {@link DataSourceStatusErrorInfo} for a malformed or unexpected payload. */
export function errorInfoFromInvalidData(message: string): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.InvalidData,
    message,
    time: Date.now(),
  };
}

/** Builds {@link DataSourceStatusErrorInfo} when the error kind is not otherwise classifiable. */
export function errorInfoFromUnknown(message: string): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.Unknown,
    message,
    time: Date.now(),
  };
}
