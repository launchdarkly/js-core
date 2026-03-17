/**
 * Converts a flag key to camelCase, matching the behavior of the legacy
 * launchdarkly-react-client-sdk. Handles kebab-case, snake_case, dot.separated,
 * ALL_CAPS, and already-camelCased keys.
 *
 * Examples:
 *   'my-flag-key'  → 'myFlagKey'
 *   'my_flag_key'  → 'myFlagKey'
 *   'my.flag.key'  → 'myFlagKey'
 *   'MY_FLAG'      → 'myFlag'
 *   'myFlagKey'    → 'myFlagKey'
 *   'HTMLParser'   → 'htmlParser'
 */
export function toCamelCase(key: string): string {
  return key
    .replace(/([a-z\d])([A-Z])/g, '$1 $2') // camelCase boundary: myFlag → my Flag, my2Flag → my2 Flag
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ALLCAPS boundary: HTMLParser → HTML Parser
    .split(/[-._\s]+/)
    .filter(Boolean)
    .map((word, i) => {
      const lower = word.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}
