import OptionMessages from './OptionMessages';
import { ValidatedOptions } from './ValidatedOptions';
import TypeValidators from './validators';

/**
* Expression to validate characters that are allowed in tag keys and values.
*/
const allowedTagCharacters = /^(\w|\.|-)+$/;

const tagValidator = TypeValidators.StringMatchingRegex(allowedTagCharacters);

/**
 * Class for managing tags.
 *
 * @internal
 */
export default class ApplicationTags {
  public readonly value?: string;

  constructor(options: ValidatedOptions) {
    const tags: Record<string, string[]> = {};
    const { application } = options;

    if (application?.id !== null && application?.id !== undefined) {
      if (tagValidator.is(application.id)) {
        tags['application-id'] = [application.id];
      } else {
        options.logger?.warn(OptionMessages.invalidTagValue('application.id'));
      }
    }

    if (application?.version !== null && application?.version !== undefined) {
      if (tagValidator.is(application.version)) {
        tags['application-version'] = [application.version];
      } else {
        options.logger?.warn(OptionMessages.invalidTagValue('application.version'));
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
