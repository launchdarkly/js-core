export enum DataSourceErrorKind {
  /// An unexpected error, such as an uncaught exception, further
  /// described by the error message.
  Unknown = 'UNKNOWN',

  /// An I/O error such as a dropped connection.
  NetworkError = 'NETWORK_ERROR',

  /// The LaunchDarkly service returned an HTTP response with an error
  /// status, available in the status code.
  ErrorResponse = 'ERROR_RESPONSE',

  /// The SDK received malformed data from the LaunchDarkly service.
  InvalidData = 'INVALID_DATA',
}
