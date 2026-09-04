/**
 * Zero-dependency static server for local play.
 * The game has no build step, so this is all that stands between the source
 * and a browser.
 *
 *   node tools/serve.js [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const PORT = Number(process.argv[2]) || 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let path = normalize(join(ROOT, url === '/' ? 'index.html' : url));

    // Refuse to serve anything outside the project directory.
    if (!path.startsWith(ROOT + sep) && path !== ROOT) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(path).catch(() => null);
    if (info?.isDirectory()) path = join(path, 'index.html');

    const data = await readFile(path);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Deep Space running at http://localhost:${PORT}`);
});
