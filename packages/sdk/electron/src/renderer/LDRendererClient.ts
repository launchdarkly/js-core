import type { LDClient } from '../LDClient';

export interface LDRendererClient extends Omit<
  LDClient,
  'logger' | 'addHook' | 'start' | 'on' | 'off'
> {
  /**
   * In the renderer client, the on method returns a callback handle that can be used to remove the listener.
   *
   * @example
   *
   * ```ts
   * const handle = client.on('event', (...args) => {
   *   // do something
   * });
   *
   * // later
   * client.off(handle);
   * ```
   *
   * @param key The name of the event to listen for.
   * @param callback The function to execute when the event fires. The callback may or may not
   * receive parameters, depending on the type of event.
   * @returns A string that can be used to remove the listener.
   */
  on(key: string, callback: (...args: any[]) => void): string;

  /**
   * Removes a listener from an event.
   *
   * @param handle The handle returned from the on method.
   */
  off(handle: string): void;
}
