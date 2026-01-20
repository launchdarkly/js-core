import type { LDClient } from '../LDClient';

export type LDClientBridge = Omit<LDClient, 'logger' | 'close' | 'addHook' | 'on' | 'off'> & {
  addEventHandler(eventName: string, callback: (...args: any[]) => void): string;
  removeEventHandler(eventName: string, callbackId: string): boolean;
};
