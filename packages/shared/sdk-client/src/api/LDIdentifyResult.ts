/**
 * The identify operation completed successfully.
 */
export interface LDIdentifySuccess {
  status: 'completed';
}

/**
 * The identify operation encountered an error. This could include a malformed context, or a network error.
 */
export interface LDIdentifyError {
  status: 'error';
  error: Error;
}

/**
 * The identify operation timed out.
 */
export interface LDIdentifyTimeout {
  status: 'timeout';
  timeout: number;
}

/**
 * The identify operation was shed.
 */
export interface LDIdentifyShed {
  status: 'shed';
}

export type LDIdentifyResult =
  | LDIdentifySuccess
  | LDIdentifyError
  | LDIdentifyTimeout
  | LDIdentifyShed;
