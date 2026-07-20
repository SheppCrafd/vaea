#!/usr/bin/env node
'use strict';

// Native launcher: packaged via pkg into a single executable with the Node
// runtime AND the app's built files embedded inside it. No PowerShell/Python
// dependency, no companion files, works from any folder.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = path.join(__dirname, 'app');
const PREFERRED_PORT = 4173;
const MAX_PORT_ATTEMPTS = 20;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

if (!fs.existsSync(ROOT)) {
  console.error('Could not find the embedded app files.');
  process.exit(1);
}

function safeJoin(base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\]?\.\.[/\\])+/, '');
  return path.join(base, normalized);
}

const server = http.createServer((req, res) => {
  let filePath = safeJoin(ROOT, req.url === '/' ? '/index.html' : req.url);

  fs.stat(filePath, (err, stats) => {
    // SPA fallback: any route that isn't a real file goes to index.html
    // so client-side routing (react-router) still works on refresh/deep link.
    if (err || !stats.isFile()) {
      filePath = path.join(ROOT, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

function openBrowser(url) {
  const commands = {
    win32: `start "" "${url}"`,
    darwin: `open "${url}"`,
  };
  const cmd = commands[os.platform()] || `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`  Could not auto-open a browser — open this URL manually: ${url}`);
  });
}

function tryListen(port, attemptsLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      tryListen(port + 1, attemptsLeft - 1);
    } else {
      console.error('Could not start the local server:', err.message);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log('');
    console.log('  Portfolio Tracker is running.');
    console.log(`  ${url}`);
    console.log('');
    console.log('  All your data is stored locally in this browser only — nothing');
    console.log('  is sent to a server. The AI chat widget is included but needs a');
    console.log('  Base44 account to work.');
    console.log('');
    console.log('  Close this window (or press Ctrl+C) to stop the app.');
    openBrowser(url);
  });
}

tryListen(PREFERRED_PORT, MAX_PORT_ATTEMPTS);
