import { TypeValidators } from '@launchdarkly/js-sdk-common';
import OptionMessages from './OptionMessages';
import { ValidatedOptions } from './ValidatedOptions';

/**
* Expression to validate characters that are allowed in tag keys and values.
*/
const allowedTagCharacters = /^(\w|\.|-)+$/;

const tagValidator = TypeValidators.stringMatchingRegex(allowedTagCharacters);

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
      if (!tagValidator.is(application.id)) {
        options.logger?.warn(OptionMessages.invalidTagValue('application.id'));
      } else if (application.id.length > 64) {
        options.logger?.warn(OptionMessages.tagValueTooLong('application.id'));
      } else {
        tags['application-id'] = [application.id];
      }
    }

    if (application?.version !== null && application?.version !== undefined) {
      if (!tagValidator.is(application.version)) {
        options.logger?.warn(OptionMessages.invalidTagValue('application.version'));
      } else if (application.version.length > 64) {
        options.logger?.warn(OptionMessages.tagValueTooLong('application.version'));
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
