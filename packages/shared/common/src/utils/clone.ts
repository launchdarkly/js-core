export default function clone<T>(obj: any) {
  return JSON.parse(JSON.stringify(obj)) as T;
}
