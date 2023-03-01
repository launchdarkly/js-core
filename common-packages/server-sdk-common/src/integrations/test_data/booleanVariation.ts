export const TRUE_VARIATION_INDEX = 0;
export const FALSE_VARIATION_INDEX = 1;

/**
 * @internal
 */
export function variationForBoolean(val: boolean) {
  return val ? TRUE_VARIATION_INDEX : FALSE_VARIATION_INDEX;
}
