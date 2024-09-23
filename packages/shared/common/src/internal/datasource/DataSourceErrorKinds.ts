export enum DataSourceErrorKind {
  /// An unexpected error, such as an uncaught exception, further
  /// described by the error message.
  Unknown,

  /// An I/O error such as a dropped connection.
  NetworkError,

  /// The LaunchDarkly service returned an HTTP response with an error
  /// status, available in the status code.
  ErrorResponse,

  /// The SDK received malformed data from the LaunchDarkly service.
  InvalidData,

  /// The data source itself is working, but when it tried to put an
  /// update into the data store, the data store failed (so the SDK may
  /// not have cached the latest data).
  StoreError,
}
