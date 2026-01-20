import type { LDClient } from '../LDClient';

export type LDRendererClient = Omit<LDClient, 'logger' | 'close' | 'addHook'>;
