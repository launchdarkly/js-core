import LDOptions from './LDOptions';
import { getDefaults } from './defaultsAndValidators';

export default class Configuration {
  config: LDOptions = getDefaults();

  constructor(options: LDOptions) {
    this.config = { ...this.config, ...options };
  }
}
