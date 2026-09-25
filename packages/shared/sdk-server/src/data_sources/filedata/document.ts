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
 * Reports that one data file could not be read or parsed. The path identifies the file. This
 * distinguishes a per-file failure from a failure to merge the documents.
 *
 * @internal
 */
export class FileDataReadError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${message} [${path}]`);
    this.name = 'FileDataReadError';
  }
}

/**
 * Reports whether a path uses a YAML file extension.
 *
 * @internal
 */
export function isYamlPath(path: string): boolean {
  return path.endsWith('.yml') || path.endsWith('.yaml');
}

/**
 * A JSON document for this purpose is always an object, so JSON text starts with an opening
 * brace. Any other text is treated as YAML.
 */
function looksLikeJson(data: string): boolean {
  return /^\s*\{/.test(data);
}

function isPlainObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks that a member of the document is an object keyed by item key, and that every entry
 * in it is an object. The key of an entry is filled from the map key when the entry omits it.
 */
function validateItems(document: Record<string, any>, member: 'flags' | 'segments'): void {
  const items = document[member];
  if (items === undefined || items === null) {
    return;
  }
  if (!isPlainObject(items)) {
    throw new Error(`"${member}" must be an object keyed by ${member.slice(0, -1)} key`);
  }
  Object.entries(items).forEach(([key, item]) => {
    if (!isPlainObject(item)) {
      throw new Error(`${member.slice(0, -1)} "${key}" must be an object`);
    }
    if (item.key === undefined) {
      // eslint-disable-next-line no-param-reassign
      item.key = key;
    }
  });
}

function validateDocument(parsed: any): FileDataDocument {
  if (parsed === undefined || parsed === null) {
    // An empty file is an empty document.
    return {};
  }
  if (!isPlainObject(parsed)) {
    throw new Error('file data must be an object');
  }
  validateItems(parsed, 'flags');
  validateItems(parsed, 'segments');
  const { flagValues } = parsed;
  if (flagValues !== undefined && flagValues !== null && !isPlainObject(flagValues)) {
    throw new Error('"flagValues" must be an object keyed by flag key');
  }
  const document: FileDataDocument = {};
  if (parsed.flags) {
    document.flags = parsed.flags;
  }
  if (flagValues) {
    document.flagValues = flagValues;
  }
  if (parsed.segments) {
    document.segments = parsed.segments;
  }
  return document;
}

/**
 * Parses the text of one data file. A file with a `.yml` or `.yaml` extension is YAML. Any
 * other file is JSON when its text starts with an opening brace, and YAML otherwise. YAML
 * needs a parser. Without one, a YAML file is an error.
 *
 * The result is validated: the document and its `flags`, `flagValues`, and `segments`
 * members must be objects, and every flag and segment entry must be an object.
 *
 * @param path The path of the file, used for format detection and error messages.
 * @param data The text of the file.
 * @param yamlParser The YAML parser, if any.
 * @returns The parsed document.
 *
 * @internal
 */
export function parseDocument(
  path: string,
  data: string,
  yamlParser?: YamlParser,
): FileDataDocument {
  let parsed: any;
  if (isYamlPath(path) || !looksLikeJson(data)) {
    if (!yamlParser) {
      throw new Error(`Attempted to parse yaml file (${path}) without parser.`);
    }
    parsed = yamlParser(data);
  } else {
    parsed = JSON.parse(data);
  }
  return validateDocument(parsed);
}

/**
 * Reports whether a filesystem error means that the file does not exist.
 *
 * @internal
 */
export function isFileNotFoundError(err: unknown): boolean {
  return (err as { code?: string } | undefined)?.code === 'ENOENT';
}
