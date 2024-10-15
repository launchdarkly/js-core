export function invalidInspector(type: string, name: string) {
  return `an inspector: "${name}" of an invalid type (${type}) was configured`;
}

export function inspectorMethodError(type: string, name: string) {
  return `an inspector: "${name}" of type: "${type}" generated an exception`;
}
