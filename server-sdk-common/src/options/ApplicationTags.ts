import { TypeValidators } from '@launchdarkly/js-sdk-common';
import OptionMessages from './OptionMessages';
import { ValidatedOptions } from './ValidatedOptions';

/**
* Expression to validate characters that are allowed in tag keys and values.
*/
const allowedTagCharacters = /^(\w|\.|-)+$/;

const regexValidator = TypeValidators.stringMatchingRegex(allowedTagCharacters);

const tagValidator = {
  is: (u: unknown, name: string): { valid: boolean, message?: string } => {
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
 *
 * @internal
 */
export default class ApplicationTags {
  public readonly value?: string;

  constructor(options: ValidatedOptions) {
    const tags: Record<string, string[]> = {};
    const application = options?.application;

    if (application?.id !== null && application?.id !== undefined) {
      const { valid, message } = tagValidator.is(application.id, 'application.id');

      if (!valid) {
        options.logger?.warn(message);
      } else {
        tags['application-id'] = [application.id];
      }
    }

    if (application?.version !== null && application?.version !== undefined) {
      const { valid, message } = tagValidator.is(application.version, 'application.version');
      if (!valid) {
        options.logger?.warn(message);
      } else {
        tags['application-version'] = [application.version];
      }
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
