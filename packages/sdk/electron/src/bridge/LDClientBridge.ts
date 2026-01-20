import type { LDClient } from '../LDClient';

export type LDClientBridge = Omit<
  LDClient,
  'logger' | 'close' | 'addHook' | 'on' | 'off' | 'start'
> & {
  /** Bridge API used to implement renderer on() over IPC. See bridge/index.ts and main process addEventHandler handler. */
  addEventHandler(eventName: string, callback: (...args: any[]) => void): string;
  /** Bridge API used to implement renderer off() over IPC. See bridge/index.ts and main process removeEventHandler handler. */
  removeEventHandler(eventName: string, callbackId: string): boolean;
};
