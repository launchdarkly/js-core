/**
 * Get the event target. This is wrapped because in some situations a browser may throw when
 * accessing the event target.
 *
 * @param event The event to get the target from.
 * @returns The event target, or undefined if one is not available.
 */
export default function getTarget(event: { target: any }): Element | undefined {
  try {
    return event.target as Element;
  } catch {
    return undefined;
  }
}
