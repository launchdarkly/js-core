import { DataSourceErrorKind, internal } from '@launchdarkly/js-sdk-common';

import DataSourceStatusErrorInfo from '../DataSourceStatusErrorInfo';
import { FallbackDirective } from './fallbackDirective';

/**
 * Possible states for a status result from an FDv2 data source.
 *
 * - `interrupted`: Transient error; synchronizer will retry automatically.
 * - `shutdown`: Graceful shutdown; no further results will be produced.
 * - `terminal_error`: Unrecoverable error; no further results will be produced.
 * - `goodbye`: Server-initiated disconnect. Synchronizers reconnect internally
 *   and may still produce results; initializers are single-shot, so the
 *   orchestrator just moves on to the next one.
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
   * uses a default); `0` means indefinite (no recovery).
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
   * uses a default); `0` means indefinite (no recovery).
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
  fallback: FallbackDirective,
  environmentId?: string,
  freshness?: number,
): FDv2SourceResult {
  return {
    type: 'changeSet',
    payload,
    fdv1Fallback: fallback.fdv1Fallback,
    environmentId,
    freshness,
    fdv1FallbackTtlMs: fallback.fdv1FallbackTtlMs,
  };
}

/**
 * Signals a transient error. Synchronizers retry automatically; for an
 * initializer this is terminal since there is no retry loop.
 */
export function interrupted(
  errorInfo: DataSourceStatusErrorInfo,
  fallback: FallbackDirective,
): FDv2SourceResult {
  return {
    type: 'status',
    state: 'interrupted',
    errorInfo,
    fdv1Fallback: fallback.fdv1Fallback,
    fdv1FallbackTtlMs: fallback.fdv1FallbackTtlMs,
  };
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
  fallback: FallbackDirective,
): FDv2SourceResult {
  return {
    type: 'status',
    state: 'terminal_error',
    errorInfo,
    fdv1Fallback: fallback.fdv1Fallback,
    fdv1FallbackTtlMs: fallback.fdv1FallbackTtlMs,
  };
}

/**
 * Signals a server-initiated disconnect. Unlike `terminal_error`, the
 * synchronizer will reconnect; the orchestrator does not block this source.
 *
 * @param reason Human-readable description of why the server closed the stream.
 * @param fallback The FDv1 fallback directive. `fdv1Fallback === true` means the
 *   server directed the client to fall back to FDv1. `fdv1FallbackTtlMs` is how
 *   long (ms) to remain on FDv1 before attempting FDv2 recovery (omit for the
 *   caller's default; `0` for indefinite). Same semantics as
 *   {@link StatusResult.fdv1FallbackTtlMs}.
 */
export function goodbye(reason: string, fallback: FallbackDirective): FDv2SourceResult {
  return {
    type: 'status',
    state: 'goodbye',
    reason,
    fdv1Fallback: fallback.fdv1Fallback,
    fdv1FallbackTtlMs: fallback.fdv1FallbackTtlMs,
  };
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
