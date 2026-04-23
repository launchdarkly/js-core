import { LDLogger } from '../api';
import { TypeValidators } from '../validators';
import OptionMessages from './OptionMessages';

/**
 * Expression to validate characters that are allowed in tag keys and values.
 */
const allowedTagCharacters = /^(\w|\.|-)+$/;

const regexValidator = TypeValidators.stringMatchingRegex(allowedTagCharacters);

const tagValidator = {
  is: (u: unknown, name: string): { valid: boolean; message?: string } => {
    if (regexValidator.is(u)) {
      if (u.length > 64) {
        return { valid: false, message: OptionMessages.tagValueTooLong(name) };
      }
      return { valid: true };
    }
    return { valid: false, message: OptionMessages.invalidTagValue(name) };
  },
};

/**
 * Class for managing tags.
 */
export default class ApplicationTags {
  public readonly value?: string;

  constructor(options: {
    application?: { id?: string; version?: string; name?: string; versionName?: string };
    logger?: LDLogger;
  }) {
    const tags: Record<string, string[]> = {};
    const application = options?.application;
    const logger = options?.logger;

    if (application) {
      Object.entries(application).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          const { valid, message } = tagValidator.is(value, `application.${key}`);

          if (!valid) {
            logger?.warn(message);
          } else if (key === 'versionName') {
            tags[`application-version-name`] = [value];
          } else {
            tags[`application-${key}`] = [value];
          }
        }
      });
    }

    const tagKeys = Object.keys(tags);
    if (tagKeys.length) {
      this.value = tagKeys
        .sort()
        .flatMap((key) => tags[key].sort().map((value) => `${key}/${value}`))
        .join(' ');
    }
  }
}
