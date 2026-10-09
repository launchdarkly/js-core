import { isNullish } from '@launchdarkly/js-sdk-common';

import {
  DocumentParser,
  FileDataDocument,
  parseDocumentByExtension,
  YamlParser,
} from '../data_sources/filedata';
import { isPlainObject } from './validateDefinition';

/**
 * Checks that a member of the document is an object keyed by item key, and that every entry
 * in it is an object. The key of an entry is filled from the map key when the entry omits it.
 */
function validateItems(document: Record<string, any>, member: 'flags' | 'segments'): void {
  const items = document[member];
  if (isNullish(items)) {
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
      item.key = key;
    }
  });
}

function validateDocument(parsed: any): FileDataDocument {
  if (isNullish(parsed)) {
    // An empty file is an empty document.
    return {};
  }
  if (!isPlainObject(parsed)) {
    throw new Error('file data must be an object');
  }
  validateItems(parsed, 'flags');
  validateItems(parsed, 'segments');
  const { flagValues } = parsed;
  if (!isNullish(flagValues) && !isPlainObject(flagValues)) {
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
 * The document parser of the file-based override source. The format is chosen by file extension,
 * as for the file data sources: a `.yml` or `.yaml` file uses the YAML parser and every other file
 * is JSON. YAML needs a parser. Without one, a YAML file is an error.
 *
 * The result is validated: the document and its `flags`, `flagValues`, and `segments` members
 * must be objects, every flag and segment entry must be an object, and an entry that omits its
 * `key` gets it from the map key. An empty document is a document with no members.
 *
 * @internal
 */
export function parseOverrideDocument(yamlParser?: YamlParser): DocumentParser {
  const parse = parseDocumentByExtension(yamlParser);
  return (path, data) => validateDocument(parse(path, data));
}
