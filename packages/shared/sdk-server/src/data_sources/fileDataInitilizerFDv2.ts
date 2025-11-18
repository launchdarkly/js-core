import {
  DataSourceErrorKind,
  Filesystem,
  internal,
  LDLogger,
  LDPollingError,
  Platform,
  subsystem as subsystemCommon,
} from '@launchdarkly/js-sdk-common';

import { FileDataInitializerOptions } from '../api';
import { Flag } from '../evaluation/data/Flag';
import { Segment } from '../evaluation/data/Segment';
import Configuration from '../options/Configuration';
import { processFlag, processSegment } from '../store/serialization';
import FileLoader from './FileLoader';

/**
 * @internal
 */
export default class FileDataInitializerFDv2 implements subsystemCommon.DataSource {
  private _paths: Array<string>;
  private _logger: LDLogger | undefined;
  private _filesystem: Filesystem;
  private _yamlParser?: (data: string) => any;
  private _fileLoader?: FileLoader;

  // TODO: do a options check here
  constructor(config: Configuration, platform: Platform) {
    const options = config.dataSystem?.dataSource?.initializerOptions as FileDataInitializerOptions;
    this._validateInputs(options, platform);

    this._paths = options.paths;
    this._logger = config.logger;
    this._filesystem = platform.fileSystem!;
    this._yamlParser = options.yamlParser;
  }

  private _validateInputs(options: FileDataInitializerOptions, platform: Platform) {
    if (!options.paths || options.paths.length === 0) {
      throw new Error('FileDataInitializerFDv2: paths are required');
    }

    if (!platform.fileSystem) {
      throw new Error('FileDataInitializerFDv2: file system is required');
    }
  }

  start(
    dataCallback: (basis: boolean, data: any) => void,
    statusCallback: (status: subsystemCommon.DataSourceState, err?: any) => void,
  ) {
    statusCallback(subsystemCommon.DataSourceState.Initializing);
    const initMetadata = internal.initMetadataFromHeaders(undefined);

    const payloadProcessor = new internal.PayloadProcessor(
      {
        flag: (flag: Flag) => {
          processFlag(flag);
          return flag;
        },
        segment: (segment: Segment) => {
          processSegment(segment);
          return segment;
        },
      },
      (errorKind: DataSourceErrorKind, message: string) => {
        statusCallback(
          subsystemCommon.DataSourceState.Interrupted,
          new LDPollingError(errorKind, message),
        );
      },
      this._logger,
    );

    this._fileLoader = new FileLoader(
      this._filesystem,
      this._paths,
      false, // autoupdate is always false for initializer
      (results: { path: string; data: string }[]) => {
        // Whenever changes are detected we re-process all of the data.
        // The FileLoader will have handled debouncing for us.
        try {
          const parsedData = this._processFileData(results);

          statusCallback(subsystemCommon.DataSourceState.Valid);

          payloadProcessor.addPayloadListener((payload) => {
            dataCallback(payload.basis, { initMetadata, payload });
          });

          payloadProcessor.processEvents(parsedData.events);

          statusCallback(subsystemCommon.DataSourceState.Closed);
        } catch (err) {
          this._logger?.error('File contained invalid data', err);
          statusCallback(
            subsystemCommon.DataSourceState.Closed,
            new LDPollingError(DataSourceErrorKind.InvalidData, 'Malformed data in file response'),
          );
        }
      },
    );

    this._fileLoader.loadAndWatch();
  }

  private _processFileData(results: { path: string; data: string }[]) {
    const combined: any = results.reduce(
      (acc, curr) => {
        let parsed: any;
        if (curr.path.endsWith('.yml') || curr.path.endsWith('.yaml')) {
          if (this._yamlParser) {
            parsed = this._yamlParser(curr.data);
          } else {
            throw new Error(`Attempted to parse yaml file (${curr.path}) without parser.`);
          }
        } else {
          parsed = JSON.parse(curr.data);
        }
        return {
          segments: {
            ...acc.segments,
            ...(parsed.segments ?? {}),
          },
          flags: {
            ...acc.flags,
            ...(parsed.flags ?? {}),
          },
        };
      },
      {
        segments: {},
        flags: {},
      },
    );

    const changeSetBuilder = new internal.FDv2ChangeSetBuilder();
    changeSetBuilder.start('xfer-full');

    Object.keys(combined).forEach((kind: string) => {
      Object.entries<any>(combined[kind]).forEach(([k, v]) => {
        changeSetBuilder.putObject({
          // strong assumption here that we only have segments and flags.
          kind: kind === 'segments' ? 'segment' : 'flag',
          key: k,
          version: v.version || 1,
          object: v,
        });
      });
    });

    return {
      events: changeSetBuilder.finish(),
    };
  }

  stop() {
    if (this._fileLoader) {
      this._fileLoader.close();
    }
  }
}
