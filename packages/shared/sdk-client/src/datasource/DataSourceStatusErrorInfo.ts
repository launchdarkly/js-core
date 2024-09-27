import { DataSourceErrorKind } from '@launchdarkly/js-sdk-common';

/// A description of an error condition that the data source encountered.
export default interface DataSourceStatusErrorInfo {
  /// An enumerated value representing the general category of the error.
  readonly kind: DataSourceErrorKind;

  /// Any additional human-readable information relevant to the error.
  ///
  /// The format is subject to change and should not be relied on
  /// programmatically.
  readonly message: string;

  /// The UNIX epoch timestamp in milliseconds that the event occurred.
  readonly time: number;

  /// The HTTP status code if the error was [ErrorKind.errorResponse].
  readonly statusCode?: number;
}
