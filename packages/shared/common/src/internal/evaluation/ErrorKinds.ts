/**
 * Different kinds of error which may be encountered during evaluation.
 */
enum ErrorKinds {
  MalformedFlag = 'MALFORMED_FLAG',
  UserNotSpecified = 'USER_NOT_SPECIFIED',
  FlagNotFound = 'FLAG_NOT_FOUND',
  ClientNotReady = 'CLIENT_NOT_READY',
  WrongType = 'WRONG_TYPE',
}

export default ErrorKinds;
