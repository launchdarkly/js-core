import { Flag } from '../../evaluation/data/Flag';
import { Segment } from '../../evaluation/data/Segment';

/**
 * A function that parses YAML text into the same structure that `JSON.parse` produces.
 *
 * @internal
 */
export type YamlParser = (data: string) => any;

/**
 * The parsed form of one data file. A document can hold full flag definitions, flag key to
 * value entries, and segment definitions. Every member is optional.
 *
 * @internal
 */
export interface FileDataDocument {
  flags?: Record<string, Flag>;
  flagValues?: Record<string, any>;
  segments?: Record<string, Segment>;
}

/**
 * Parses the text of one file into a document.
 *
 * @internal
 */
export type DocumentParser = (path: string, data: string) => FileDataDocument;

/**
 * Reports whether a path uses a YAML file extension.
 *
 * @internal
 */
export function isYamlPath(path: string): boolean {
  return path.endsWith('.yml') || path.endsWith('.yaml');
}

function parseYaml(path: string, data: string, yamlParser?: YamlParser): any {
  if (!yamlParser) {
    throw new Error(`Attempted to parse yaml file (${path}) without parser.`);
  }
  return yamlParser(data);
}

/**
 * A parser that chooses the format by file extension only. A `.yml` or `.yaml` file uses the
 * YAML parser, and every other file is JSON. The parsed value is returned as it is. This is the
 * rule of the file data sources.
 *
 * @internal
 */
export function parseDocumentByExtension(yamlParser?: YamlParser): DocumentParser {
  return (path, data) => {
    if (isYamlPath(path)) {
      return parseYaml(path, data, yamlParser);
    }
    return JSON.parse(data);
  };
}

/**
 * Reports whether a filesystem error means that the file does not exist.
 *
 * @internal
 */
export function isFileNotFoundError(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === 'ENOENT';
}
