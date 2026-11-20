/**
 * FSS-HS-SIMULATOR — validation against the EP9343126VVP datasheet.
 *
 * The checks live in src/simulation/__tests__/datasheet.test.ts so that they
 * run on the real model code (cellModel.ts) instead of a hand-copied mirror.
 * This script just runs them and the endurance sanity checks.
 *
 * Usage:  node validate.mjs
 * Assumptions and results: docs/hsc-model-assumptions.md
 */
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', [
  'vitest', 'run', '--reporter=verbose',
  'src/simulation/__tests__/datasheet.test.ts',
  'src/simulation/__tests__/hscEndurance.test.ts',
], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
