import { LDContext, LDFlagsStateOptions } from '@launchdarkly/js-server-sdk-common';

export function makeMockServerClient() {
  return {
    initialized: jest.fn(() => true),
    boolVariation: jest.fn((_key: string, _ctx: LDContext, def: boolean) => Promise.resolve(def)),
    numberVariation: jest.fn((_key: string, _ctx: LDContext, def: number) => Promise.resolve(def)),
    stringVariation: jest.fn((_key: string, _ctx: LDContext, def: string) => Promise.resolve(def)),
    jsonVariation: jest.fn((_key: string, _ctx: LDContext, def: unknown) => Promise.resolve(def)),
    boolVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: boolean) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    numberVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: number) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    stringVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: string) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    jsonVariationDetail: jest.fn((_key: string, _ctx: LDContext, def: unknown) =>
      Promise.resolve({ value: def, variationIndex: null, reason: { kind: 'OFF' as const } }),
    ),
    // @ts-ignore — mock return shape matches LDFlagsState structurally
    allFlagsState: jest.fn((_context: LDContext, _options?: LDFlagsStateOptions) =>
      Promise.resolve({
        valid: true,
        getFlagValue: jest.fn(),
        getFlagReason: jest.fn(),
        allValues: jest.fn(() => ({})),
        toJSON: jest.fn(() => ({ $flagsState: {}, $valid: true })),
      }),
    ),
    track: jest.fn(() => Promise.resolve()),
  };
}
