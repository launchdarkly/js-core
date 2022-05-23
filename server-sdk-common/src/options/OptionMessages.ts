/**
 * Messages for issues which can be encountered from processing the configuration options.
 *
 * @internal
 */
export default class OptionMessages {
  static deprecated(oldName: string, newName: string): string { return `"${oldName}" is deprecated, please use "${newName}"`; }

  static optionBelowMinimum(name: string, value: number, min: number): string {
    return `Config option "${name}" had invalid value of ${value}, using minimum of ${min} instead`;
  }

  static unknownOption(name: string): string { return `Ignoring unknown config option "${name}"`; }

  static wrongOptionType(name: string, expectedType: string, actualType: string): string {
    return `Config option "${name}" should be of type ${expectedType}, got ${actualType}, using default value`;
  }

  static wrongOptionTypeBoolean(name: string, actualType: string): string {
    return `Config option "${name}" should be a boolean, got ${actualType}, converting to boolean`;
  }

  static invalidTagValue(name: string): string {
    return `Config option "${name}" must only contain letters, numbers, ., _ or -.`;
  }
}
