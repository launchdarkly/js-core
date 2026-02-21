export function isClientSide(): boolean {
  return typeof window !== 'undefined';
}

export function isServerSide(): boolean {
  return !isClientSide();
}

/**
 * Evaluation reason returned when the isomorphic client no-ops on the server
 * (e.g. no federated server client). Used for variationDetail-style no-op returns.
 */
export const NOOP_EVALUATION_REASON = {
  kind: 'ERROR' as const,
  errorKind: 'CLIENT_NOT_READY' as const,
};
