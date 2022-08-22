export default class LDInvalidSDKKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchDarklyInvalidSDKKeyError';
  }
}
