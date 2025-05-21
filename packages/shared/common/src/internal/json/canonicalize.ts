/**
 * Given some object to serialize product a canonicalized JSON string.
 * https://www.rfc-editor.org/rfc/rfc8785.html
 *
 * We do not support custom toJSON methods on objects. Objects should be limited to basic types.
 *
 * @param object The object to serialize.
 */
export function canonicalize(object: any, visited: any[] = []): string {
  // For JavaScript the default JSON serialization will produce canonicalized output for basic types.
  if (object === null || typeof object !== 'object') {
    return JSON.stringify(object);
  }

  if (visited.includes(object)) {
    throw new Error('Cycle detected');
  }

  if (Array.isArray(object)) {
    const values = object
      .map((item) => canonicalize(item, [...visited, object]))
      .map((item) => (item === undefined ? 'null' : item));
    return `[${values.join(',')}]`;
  }

  const values = Object.keys(object)
    .sort()
    .map((key) => {
      const value = canonicalize(object[key], [...visited, object]);
      if (value !== undefined) {
        return `${JSON.stringify(key)}:${value}`;
      }
      return undefined;
    })
    .filter((item) => item !== undefined);
  return `{${values.join(',')}}`;
}
