import { LDContext, LDEvaluationReason } from '../types/compat.js';

/**
 * Structural interface that should satisfy all client-side SDKs. This is
 * used to dispatch commands from the webhook.
 */
export interface CommandableClient {
  boolVariation(flagKey: string, defaultValue: boolean): boolean;
  boolVariationDetail(
    flagKey: string,
    defaultValue: boolean,
  ): { value: boolean; variationIndex?: number | null; reason?: LDEvaluationReason };
  numberVariation(flagKey: string, defaultValue: number): number;
  numberVariationDetail(
    flagKey: string,
    defaultValue: number,
  ): { value: number; variationIndex?: number | null; reason?: LDEvaluationReason };
  stringVariation(flagKey: string, defaultValue: string): string;
  stringVariationDetail(
    flagKey: string,
    defaultValue: string,
  ): { value: string; variationIndex?: number | null; reason?: LDEvaluationReason };
  variation(flagKey: string, defaultValue: unknown): unknown;
  variationDetail(
    flagKey: string,
    defaultValue: unknown,
  ): { value: unknown; variationIndex?: number | null; reason?: LDEvaluationReason };
  identify(context: LDContext): Promise<unknown>;
  track(eventKey: string, data?: unknown, metricValue?: number): void;
  flush(): void | Promise<unknown>;
  allFlags(): Record<string, unknown>;
  close(): void;
}
