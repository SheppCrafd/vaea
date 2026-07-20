#!/usr/bin/env node
'use strict';

// Builds native single-file executables (Windows .exe, Linux ELF) with the
// Node runtime AND the app's built files embedded inside, via `pkg`. Run
// `npm run build` (repo root) and `npm install` (this folder) first.
//
// IMPORTANT: pkg only picks up package.json's "pkg.assets" field when
// invoked as `pkg .` (cwd-relative, following package.json's "bin" entry) —
// `pkg server.js` silently ignores it, and there is no CLI --assets flag in
// this pkg version. That cost real debugging time once; don't "simplify"
// this back to `pkg server.js`.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(REPO_ROOT, 'dist');
const EXE_DIR = __dirname;
const APP_DIR = path.join(EXE_DIR, 'app');
const OUT_DIR = path.join(EXE_DIR, '..');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` from the repo root first.');
  process.exit(1);
}

fs.rmSync(APP_DIR, { recursive: true, force: true });
fs.cpSync(DIST, APP_DIR, { recursive: true });

function pkg(target, output) {
  execFileSync('npx', ['pkg', '.', '--targets', target, '--output', output], {
    cwd: EXE_DIR,
    stdio: 'inherit',
    shell: true,
  });
}

pkg('node18-win-x64', path.join(OUT_DIR, 'PortfolioTracker-Windows.exe'));
pkg('node18-linux-x64', path.join(OUT_DIR, 'PortfolioTracker-Linux'));

fs.rmSync(APP_DIR, { recursive: true, force: true });

console.log('');
console.log('Wrote:');
console.log('  standalone/PortfolioTracker-Windows.exe');
console.log('  standalone/PortfolioTracker-Linux');
