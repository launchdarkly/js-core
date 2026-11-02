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

/**
 * Reports whether the text of a file has content: anything other than white space. A byte order
 * mark counts as white space.
 *
 * @internal
 */
export function hasContent(data: string): boolean {
  return /\S/.test(data);
}

function parseYaml(path: string, data: string, yamlParser?: YamlParser): any {
  if (!yamlParser) {
    throw new Error(`Attempted to parse yaml file (${path}) without parser.`);
  }
  return yamlParser(data);
}

function parseJson(data: string): any {
  if (!hasContent(data)) {
    // JSON.parse fails here too, with a message that does not say what is wrong. A file that is
    // rewritten in place can be empty for a moment, and the failure keeps the last good data.
    throw new SyntaxError('the file has no content, which is not a JSON document');
  }
  return JSON.parse(data);
}

/**
 * A parser that chooses the format by file extension only. A `.yml` or `.yaml` file uses the
 * YAML parser, and every other file is JSON. The parsed value is returned as it is. This is the
 * rule of the file data sources.
 *
 * Whether a file with no content is valid depends on its format. A JSON file with no content,
 * or only white space, is not a JSON document and fails to parse. A YAML parser returns null or
 * undefined for it, which is returned as it is.
 *
 * @internal
 */
export function parseDocumentByExtension(yamlParser?: YamlParser): DocumentParser {
  return (path, data) => {
    if (isYamlPath(path)) {
      return parseYaml(path, data, yamlParser);
    }
    return parseJson(data);
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
