export default function clone<T>(obj: any) {
  if (obj === undefined || obj === null) {
    return obj;
  }

  return JSON.parse(JSON.stringify(obj)) as T;
}
