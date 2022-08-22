import { internal } from '@launchdarkly/js-sdk-common';

export function isFeature(u: any): u is internal.InputEvalEvent {
  return u.kind === 'feature';
}

export function isCustom(u: any): u is internal.InputCustomEvent {
  return u.kind === 'custom';
}

export function isIdentify(u: any): u is internal.InputIdentifyEvent {
  return u.kind === 'identify';
}
