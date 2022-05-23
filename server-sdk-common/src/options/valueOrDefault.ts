export default function valueOrDefault<T>(value: T | undefined | null, defValue: T): T {
  if (value === undefined || value === null) {
    return defValue;
  }
  return value;
}
