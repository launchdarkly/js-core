#!/usr/bin/env node
/**
 * Tests the packed, publishable form of every released package against many consumer build
 * configurations, and compares the results with a checked-in baseline.
 *
 * Usage: node scripts/package-config-tests/run.js <suite> [--work <dir>] [--packs <dir>] [--update]
 *
 * Suites: pack, types[:<typescript version>], attw, runtime, cloudflare, vercel.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const suites = {
  pack: require('./suites/pack'),
  types: require('./suites/types'),
  attw: require('./suites/attw'),
  runtime: require('./suites/runtime'),
  cloudflare: require('./suites/cloudflare'),
  vercel: require('./suites/vercel'),
};

function parseArgs(argv) {
  const args = { update: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--update') args.update = true;
    else if (argv[i] === '--work') args.work = argv[(i += 1)];
    else if (argv[i] === '--packs') args.packs = argv[(i += 1)];
    else rest.push(argv[i]);
  }
  [args.suite] = rest;
  args.work = path.resolve(args.work || path.join(os.tmpdir(), 'ld-package-config-tests'));
  args.packs = path.resolve(args.packs || path.join(args.work, 'packs'));
  return args;
}

function compare(name, baseline, results, inScope) {
  const keys = new Set([...Object.keys(baseline).filter(inScope), ...Object.keys(results)]);
  const regressions = [];
  const changes = [];
  for (const key of [...keys].sort()) {
    const expected = baseline[key];
    const actual = results[key];
    if (expected === actual) continue;
    const line = `${key}\n    baseline: ${expected ?? '(missing)'}\n    actual:   ${actual ?? '(missing)'}`;
    if (expected === 'ok' || actual === undefined) regressions.push(line);
    else changes.push(line);
  }
  if (regressions.length) {
    console.log(`\n${name}: ${regressions.length} regression(s):\n  ${regressions.join('\n  ')}`);
  }
  if (changes.length) {
    console.log(
      `\n${name}: ${changes.length} result(s) differ from the baseline:\n  ${changes.join('\n  ')}`,
    );
  }
  return regressions.length + changes.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [suiteName, variant] = (args.suite || '').split(':');
  const suite = suites[suiteName];
  if (!suite) {
    console.error(
      `Usage: run.js <${Object.keys(suites).join('|')}> [--work dir] [--packs dir] [--update]`,
    );
    process.exit(2);
  }
  fs.mkdirSync(args.work, { recursive: true });
  const started = Date.now();
  const output = await suite.run({ ...args, variant });
  console.log(`${args.suite}: finished in ${Math.round((Date.now() - started) / 1000)}s`);
  if (!output) return;

  const { results, details = {}, inScope = () => true } = output;
  const baselineFile = path.join(__dirname, 'baseline', `${suiteName}.json`);
  const baseline = fs.existsSync(baselineFile)
    ? JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
    : {};
  fs.writeFileSync(
    path.join(args.work, `${suiteName}${variant ? `-${variant}` : ''}-details.json`),
    JSON.stringify(details, null, 2),
  );

  if (args.update) {
    const merged = Object.fromEntries(Object.entries(baseline).filter(([key]) => !inScope(key)));
    Object.assign(merged, results);
    const sorted = Object.fromEntries(
      Object.keys(merged)
        .sort()
        .map((key) => [key, merged[key]]),
    );
    fs.writeFileSync(baselineFile, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(
      `Updated ${path.relative(process.cwd(), baselineFile)} (${Object.keys(results).length} results).`,
    );
    return;
  }

  const total = Object.keys(results).length;
  const passing = Object.values(results).filter((r) => r === 'ok').length;
  console.log(
    `${args.suite}: ${total} cases, ${passing} ok, ${total - passing} not ok`,
  );
  if (compare(args.suite, baseline, results, inScope)) {
    console.log(
      `\nIf the new results are expected, run "node scripts/package-config-tests/run.js ${args.suite} --update" and commit the baseline.`,
    );
    console.log(
      `Error details for each case: ${path.join(args.work, `${suiteName}${variant ? `-${variant}` : ''}-details.json`)}`,
    );
    process.exit(1);
  }
  console.log(`${args.suite}: all results match the baseline.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
