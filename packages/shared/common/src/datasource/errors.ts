/* eslint-disable max-classes-per-file */
import { DataSourceErrorKind } from './DataSourceErrorKinds';

export class LDFileDataSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyFileDataSourceError';
  }
}

export class LDPollingError extends Error {
  public readonly kind: DataSourceErrorKind;
  public readonly status?: number;
  public readonly recoverable: boolean;

  constructor(kind: DataSourceErrorKind, message: string, status?: number, recoverable = true) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.name = 'LaunchDarklyPollingError';
    this.recoverable = recoverable;
  }
}

export class LDStreamingError extends Error {
  public readonly kind: DataSourceErrorKind;
  public readonly code?: number;
  public readonly recoverable: boolean;

  constructor(kind: DataSourceErrorKind, message: string, code?: number, recoverable = true) {
    super(message);
    this.kind = kind;
    this.code = code;
    this.name = 'LaunchDarklyStreamingError';
    this.recoverable = recoverable;
  }
}

/**
 * This is a short term error and will be removed once FDv2 adoption is sufficient.
 */
export class LDFlagDeliveryFallbackError extends Error {
  public readonly kind: DataSourceErrorKind;
  public readonly code?: number;
  public readonly recoverable: boolean;

  constructor(kind: DataSourceErrorKind, message: string, code?: number) {
    super(message);
    this.kind = kind;
    this.code = code;
    this.name = 'LDFlagDeliveryFallbackError';
    this.recoverable = false;
  }
}

export type StreamingErrorHandler = (err: LDStreamingError) => void;
