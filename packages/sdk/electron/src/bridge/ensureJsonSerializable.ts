function isJsonCompatible(value: unknown, seen: Set<unknown>): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  const t = typeof value;
  if (t === 'boolean' || t === 'number' || t === 'string') {
    return true;
  }

  if (t !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.every((item) => isJsonCompatible(item, seen));
  }

  // Reject exotic objects (Date, Map, Set, RegExp, etc.) — only plain objects are JSON-compatible.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every((v) => isJsonCompatible(v, seen));
}

/**
 * Validates that a value is JSON-compatible before it crosses the Electron IPC bridge.
 * LaunchDarkly flag values and track data must be JSON-compatible types (boolean, number,
 * string, null, or plain objects/arrays). Non-serializable values produce a warning and
 * return undefined.
 */
export function ensureJsonSerializable(value: unknown, label: string): unknown {
  // Short-circuit for primitives to avoid Set allocation.
  if (value === null || value === undefined) {
    return value;
  }
  const t = typeof value;
  if (t === 'boolean' || t === 'number' || t === 'string') {
    return value;
  }

  if (isJsonCompatible(value, new Set())) {
    return value;
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[LaunchDarkly] ${label} is not JSON-serializable (type: ${t}). ` +
      `It will be dropped. LaunchDarkly flag values must be JSON-compatible.`,
  );
  return undefined;
}
