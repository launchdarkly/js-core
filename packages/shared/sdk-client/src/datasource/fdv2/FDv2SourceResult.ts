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
 * A change set result containing a processed FDv2 payload.
 */
export interface ChangeSetResult {
  type: 'changeSet';
  payload: internal.Payload;
  fdv1Fallback: boolean;
  environmentId?: string;
}

/**
 * A status result indicating a state transition (error, shutdown, goodbye).
 */
export interface StatusResult {
  type: 'status';
  state: SourceState;
  errorInfo?: DataSourceStatusErrorInfo;
  reason?: string;
  fdv1Fallback: boolean;
}

/**
 * The result type for FDv2 initializers and synchronizers.
 *
 * An initializer produces a single result, while a synchronizer produces a
 * stream of results. Each result is either a change set (containing a payload
 * of flag data) or a status (indicating a state transition like an error or
 * shutdown).
 */
export type FDv2SourceResult = ChangeSetResult | StatusResult;

/**
 * Creates a change set result containing processed flag data.
 */
export function changeSet(
  payload: internal.Payload,
  fdv1Fallback: boolean,
  environmentId?: string,
): FDv2SourceResult {
  return { type: 'changeSet', payload, fdv1Fallback, environmentId };
}

/**
 * Creates an interrupted status result. Indicates a transient error; the
 * synchronizer will attempt to recover automatically.
 *
 * When used with an initializer, this is still a terminal state.
 */
export function interrupted(
  errorInfo: DataSourceStatusErrorInfo,
  fdv1Fallback: boolean,
): FDv2SourceResult {
  return { type: 'status', state: 'interrupted', errorInfo, fdv1Fallback };
}

/**
 * Creates a shutdown status result. Indicates the data source was closed
 * gracefully and will not produce any further results.
 */
export function shutdown(): FDv2SourceResult {
  return { type: 'status', state: 'shutdown', fdv1Fallback: false };
}

/**
 * Creates a terminal error status result. Indicates an unrecoverable error;
 * the data source will not produce any further results.
 */
export function terminalError(
  errorInfo: DataSourceStatusErrorInfo,
  fdv1Fallback: boolean,
): FDv2SourceResult {
  return { type: 'status', state: 'terminal_error', errorInfo, fdv1Fallback };
}

/**
 * Creates a goodbye status result. Indicates the server has instructed the
 * client to disconnect.
 */
export function goodbye(reason: string, fdv1Fallback: boolean): FDv2SourceResult {
  return { type: 'status', state: 'goodbye', reason, fdv1Fallback };
}

/**
 * Helper to create a {@link DataSourceStatusErrorInfo} from an HTTP status code.
 */
export function errorInfoFromHttpError(statusCode: number): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.ErrorResponse,
    message: `Unexpected status code: ${statusCode}`,
    statusCode,
    time: Date.now(),
  };
}

/**
 * Helper to create a {@link DataSourceStatusErrorInfo} from a network error.
 */
export function errorInfoFromNetworkError(message: string): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.NetworkError,
    message,
    time: Date.now(),
  };
}

/**
 * Helper to create a {@link DataSourceStatusErrorInfo} from invalid data.
 */
export function errorInfoFromInvalidData(message: string): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.InvalidData,
    message,
    time: Date.now(),
  };
}

/**
 * Helper to create a {@link DataSourceStatusErrorInfo} for unknown errors.
 */
export function errorInfoFromUnknown(message: string): DataSourceStatusErrorInfo {
  return {
    kind: DataSourceErrorKind.Unknown,
    message,
    time: Date.now(),
  };
}
