/**
 * Test entry point. Installs the browser fakes BEFORE importing anything from
 * src/, since some modules touch globals at import time.
 *
 *   node tests/run.js              run everything
 *   node tests/run.js --filter x   run matching tests only
 */
import { installAll, run } from './harness.js';

installAll();

const args = process.argv.slice(2);
const fIdx = args.indexOf('--filter');
const filter = fIdx >= 0 ? args[fIdx + 1] : null;

const SUITES = [
  './rng.test.js',
  './audio.test.js',
  './art.test.js',
  './game.test.js',
  './save.test.js',
  './integration.test.js',
];

for (const s of SUITES) await import(s);

const result = await run({ filter });
process.exit(result.failed === 0 ? 0 : 1);
