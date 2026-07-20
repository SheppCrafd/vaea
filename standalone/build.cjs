#!/usr/bin/env node
'use strict';

// Regenerates the two self-contained standalone launchers
// (PortfolioTracker-Windows.bat, PortfolioTracker-Linux.sh) by embedding the
// current production build directly into each launcher as base64. Each
// output file is fully standalone — no companion files, nothing to lose by
// only grabbing one file out of an archive.
//
// Run `npm run build` first. Packaging itself needs PowerShell (for the zip
// payload) and `tar` (for the tar.gz payload) on THIS machine — the
// generated launchers themselves need neither; they only need PowerShell
// (Windows, always present) or python3/python (Linux/macOS, near-universal).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = __dirname;
const TPL_DIR = path.join(OUT_DIR, 'templates');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

function wrap(b64) {
  return b64.match(/.{1,100}/g).join('\n');
}

// --- Windows payload: zip of dist/ ---
const zipPath = path.join(OUT_DIR, '_payload.zip');
if (fs.existsSync(zipPath)) fs.rmSync(zipPath);
execFileSync('powershell', [
  '-NoProfile', '-Command',
  `Compress-Archive -Path '${DIST}\\*' -DestinationPath '${zipPath}'`,
]);
const zipB64 = fs.readFileSync(zipPath).toString('base64');
fs.rmSync(zipPath);

const batTemplate = fs.readFileSync(path.join(TPL_DIR, 'windows.bat.tpl'), 'utf8');
const batOut = batTemplate.replace('__PAYLOAD_B64__', wrap(zipB64));
fs.writeFileSync(path.join(OUT_DIR, 'PortfolioTracker-Windows.bat'), batOut.replace(/\n/g, '\r\n'));

// --- Linux/macOS payload: tar.gz of dist/ ---
const tgzPath = path.join(OUT_DIR, '_payload.tar.gz');
if (fs.existsSync(tgzPath)) fs.rmSync(tgzPath);
// --force-local: without it, Windows' built-in bsdtar misreads the "C:" in
// an absolute Windows path as a remote host spec ("host:path" rsh syntax).
execFileSync('tar', ['--force-local', '-czf', tgzPath, '-C', DIST, '.']);
const tgzB64 = fs.readFileSync(tgzPath).toString('base64');
fs.rmSync(tgzPath);

const shTemplate = fs.readFileSync(path.join(TPL_DIR, 'linux.sh.tpl'), 'utf8');
const shOut = shTemplate.replace('__PAYLOAD_B64__', wrap(tgzB64));
fs.writeFileSync(path.join(OUT_DIR, 'PortfolioTracker-Linux.sh'), shOut, { mode: 0o755 });
fs.chmodSync(path.join(OUT_DIR, 'PortfolioTracker-Linux.sh'), 0o755);

console.log('Wrote:');
console.log('  standalone/PortfolioTracker-Windows.bat');
console.log('  standalone/PortfolioTracker-Linux.sh');
