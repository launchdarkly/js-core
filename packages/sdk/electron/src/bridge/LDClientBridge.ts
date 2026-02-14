import type { LDClient } from '../LDClient';

export type LDClientBridge = Omit<
  LDClient,
  'logger' | 'close' | 'addHook' | 'on' | 'off' | 'start'
> & {
  /**
   * Bridge API used to implement renderer on() over IPC.
   *
   * @param eventName The name of the event to listen for.
   * @param callback The function to execute when the event fires. The callback may or may not
   * receive parameters, depending on the type of event.
   * @returns A string that can be used to remove the listener.
   */
  addEventHandler(eventName: string, callback: (...args: any[]) => void): string;
  /**
   * Bridge API used to implement renderer off() over IPC. See bridge/index.ts
   * and main process removeEventHandler handler.
   *
   * @param callbackId The handle returned from the on method.
   * @returns Whether the listener was removed successfully.
   */
  removeEventHandler(callbackId: string): boolean;
};
