import { LDClientContext, OptionMessages, TypeValidators } from '@launchdarkly/js-sdk-common';

import {
  FileOverrideSourceOptions,
  isFileOverrideSourceOptions,
  LDOverrideSourceOptions,
} from '../api/options/LDDataSystemOptions';
import { LDOverrideSource } from '../api/subsystems';
import { DuplicateKeysHandling, YamlParser } from '../data_sources/filedata';
import FileOverrideSource, {
  DEFAULT_POLL_INTERVAL_SECONDS,
  FileChangeDetection,
  FileOverrideSourceConfig,
  MINIMUM_POLL_INTERVAL_SECONDS,
} from './FileOverrideSource';

function isOverrideSource(u: unknown): u is LDOverrideSource {
  const candidate = u as Partial<LDOverrideSource> | undefined;
  return (
    TypeValidators.Function.is(candidate?.start) && TypeValidators.Function.is(candidate?.close)
  );
}

const duplicateKeysHandlingValues: DuplicateKeysHandling[] = ['fail', 'ignore'];
const changeDetectionValues: FileChangeDetection[] = ['polling', 'watching'];

/**
 * Validates the options of the file-based override source. A configuration error, such as no
 * file paths or an unrecognized change detection mode, throws. A value that has a safe default,
 * such as an unrecognized duplicate keys handling or a polling interval below the minimum, is
 * logged and replaced.
 */
function validateFileOverrideSourceOptions(
  options: FileOverrideSourceOptions,
  clientContext: LDClientContext,
  defaultYamlParser?: YamlParser,
): FileOverrideSourceConfig {
  const { logger } = clientContext.basicConfiguration;
  if (
    !TypeValidators.StringArray.is(options.paths) ||
    options.paths.length === 0 ||
    options.paths.some((path) => path === '')
  ) {
    throw new Error('The file-based override source requires at least one file path');
  }

  let duplicateKeysHandling: DuplicateKeysHandling = 'fail';
  if (options.duplicateKeysHandling !== undefined) {
    if (duplicateKeysHandlingValues.includes(options.duplicateKeysHandling)) {
      duplicateKeysHandling = options.duplicateKeysHandling;
    } else {
      logger?.warn(
        OptionMessages.wrongOptionType(
          'dataSystem.overrides.duplicateKeysHandling',
          duplicateKeysHandlingValues.map((value) => `'${value}'`).join(' | '),
          String(options.duplicateKeysHandling),
        ),
      );
    }
  }

  let changeDetection: FileChangeDetection = 'polling';
  if (options.changeDetection !== undefined) {
    if (!changeDetectionValues.includes(options.changeDetection)) {
      throw new Error(
        `Unrecognized change detection mode "${options.changeDetection}" for the file-based override source`,
      );
    }
    changeDetection = options.changeDetection;
  }

  let pollIntervalSeconds = DEFAULT_POLL_INTERVAL_SECONDS;
  if (options.pollInterval !== undefined) {
    if (!TypeValidators.Number.is(options.pollInterval)) {
      logger?.warn(
        OptionMessages.wrongOptionType(
          'dataSystem.overrides.pollInterval',
          'number',
          typeof options.pollInterval,
        ),
      );
    } else if (options.pollInterval < MINIMUM_POLL_INTERVAL_SECONDS) {
      logger?.warn(
        OptionMessages.optionBelowMinimum(
          'dataSystem.overrides.pollInterval',
          options.pollInterval,
          MINIMUM_POLL_INTERVAL_SECONDS,
        ),
      );
      pollIntervalSeconds = MINIMUM_POLL_INTERVAL_SECONDS;
    } else {
      pollIntervalSeconds = options.pollInterval;
    }
  }

  let yamlParser = defaultYamlParser;
  if (options.yamlParser !== undefined) {
    if (TypeValidators.Function.is(options.yamlParser)) {
      yamlParser = options.yamlParser;
    } else {
      logger?.warn(
        OptionMessages.wrongOptionType(
          'dataSystem.overrides.yamlParser',
          'function',
          typeof options.yamlParser,
        ),
      );
    }
  }

  return {
    paths: options.paths,
    duplicateKeysHandling,
    changeDetection,
    pollIntervalMs: pollIntervalSeconds * 1000,
    yamlParser,
  };
}

/**
 * Creates the override source described by the data system options. A configuration that does
 * not describe a source is an error, reported the way an unsupported data source configuration
 * is reported: by throwing from client construction.
 *
 * @internal
 */
export default function createOverrideSource(
  options: LDOverrideSourceOptions,
  clientContext: LDClientContext,
  defaultYamlParser?: YamlParser,
): LDOverrideSource {
  if (TypeValidators.Function.is(options)) {
    return (options as (clientContext: LDClientContext) => LDOverrideSource)(clientContext);
  }
  if (isFileOverrideSourceOptions(options)) {
    const { fileSystem } = clientContext.platform;
    if (!fileSystem) {
      throw new Error('The file-based override source requires a platform with filesystem support');
    }
    return new FileOverrideSource(
      validateFileOverrideSourceOptions(options, clientContext, defaultYamlParser),
      fileSystem,
      clientContext.basicConfiguration.logger,
    );
  }
  if (isOverrideSource(options)) {
    return options;
  }
  throw new Error('Unsupported override source configuration');
}
