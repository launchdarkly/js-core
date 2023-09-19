// These classes are of trivial complexity. If they become
// more complex, then they could be independent files.
/* eslint-disable max-classes-per-file */

export class LDFileDataSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyFileDataSourceError';
  }
}

export class LDPollingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyPollingError';
  }
}

export class LDStreamingError extends Error {
  public readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.code = code;
    this.name = 'LaunchDarklyStreamingError';
  }
}

export class LDUnexpectedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyUnexpectedResponseError';
  }
}

export class LDClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyClientError';
  }
}

export function isHttpRecoverable(status: number) {
  if (status >= 400 && status < 500) {
    return status === 400 || status === 408 || status === 429;
  }
  return true;
}
