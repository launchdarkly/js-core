import { DeleteFlag, Flag, Flags, PatchFlag } from '../types';

function tryParse(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFlag(value: unknown): value is Flag {
  return isObject(value) && typeof value.version === 'number';
}

function isPatchFlag(value: unknown): value is PatchFlag {
  return isFlag(value) && typeof (value as PatchFlag).key === 'string';
}

/**
 * Parses the data of a stream put event.
 *
 * @returns The flags, or undefined if the data is not JSON or a flag is not an object with a
 * numeric version.
 */
export function deserializePut(data: string): Flags | undefined {
  const parsed = tryParse(data);
  if (!isObject(parsed) || !Object.values(parsed).every(isFlag)) {
    return undefined;
  }
  return parsed as Flags;
}

/**
 * Parses the data of a stream patch event.
 *
 * @returns The flag, or undefined if the data is not JSON or does not have a string key and a
 * numeric version.
 */
export function deserializePatch(data: string): PatchFlag | undefined {
  const parsed = tryParse(data);
  return isPatchFlag(parsed) ? parsed : undefined;
}

/**
 * Parses the data of a stream delete event.
 *
 * @returns The key and version, or undefined if the data is not JSON or does not have a string
 * key and a numeric version.
 */
export function deserializeDelete(data: string): DeleteFlag | undefined {
  const parsed = tryParse(data);
  if (!isObject(parsed) || typeof parsed.key !== 'string' || typeof parsed.version !== 'number') {
    return undefined;
  }
  return parsed as DeleteFlag;
}
