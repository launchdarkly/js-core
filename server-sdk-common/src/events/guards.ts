import InputCustomEvent from './InputCustomEvent';
import InputEvalEvent from './InputEvalEvent';
import InputIdentifyEvent from './InputIdentifyEvent';

export function isFeature(u: any): u is InputEvalEvent {
  return u.kind === 'feature';
}

export function isCustom(u: any): u is InputCustomEvent {
  return u.kind === 'custom';
}

export function isIdentify(u: any): u is InputIdentifyEvent {
  return u.kind === 'identify';
}
