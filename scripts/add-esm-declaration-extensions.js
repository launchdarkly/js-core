#!/usr/bin/env node

/**
 * Adds explicit file extensions to relative imports in emitted ESM declaration files.
 *
 * TypeScript emits declaration files with the same extensionless specifiers used in the
 * source (e.g. `export * from './api'`). Under `moduleResolution: node16/nodenext`, ESM
 * declaration files must use fully specified relative imports, so those specifiers fail
 * to resolve (TS2834). This rewrites them to `./api/index.js` or `./api.js`.
 *
 * Usage: add-esm-declaration-extensions.js <declaration directory>
 */

const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('Usage: add-esm-declaration-extensions.js <declaration directory>');
  process.exit(1);
}

const specifierPattern =
  /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*|\.{1,2})\2/g;

function resolveSpecifier(file, specifier) {
  if (/\.(c|m)?js$|\.json$/.test(specifier)) {
    return specifier;
  }
  const base = path.resolve(path.dirname(file), specifier);
  if (fs.existsSync(`${base}.d.ts`)) {
    return `${specifier}.js`;
  }
  if (fs.existsSync(path.join(base, 'index.d.ts'))) {
    return `${specifier.replace(/\/$/, '')}/index.js`;
  }
  throw new Error(`Unable to resolve '${specifier}' imported from ${file}`);
}

function* declarationFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* declarationFiles(entryPath);
    } else if (entry.name.endsWith('.d.ts')) {
      yield entryPath;
    }
  }
}

for (const file of declarationFiles(root)) {
  const contents = fs.readFileSync(file, 'utf8');
  const updated = contents.replace(
    specifierPattern,
    (_match, prefix, quote, specifier) =>
      `${prefix}${quote}${resolveSpecifier(file, specifier)}${quote}`,
  );
  if (updated !== contents) {
    fs.writeFileSync(file, updated);
  }
}
