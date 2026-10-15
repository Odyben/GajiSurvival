import './build.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const path = new URL(req.url, 'http://localhost').pathname;
  const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'], '/sw.js': ['sw.js', 'text/javascript'], '/icon-192.png': ['icon-192.png', 'image/png'], '/icon-512.png': ['icon-512.png', 'image/png'] };
  if (!Object.hasOwn(files, path)) { res.writeHead(404); res.end('Not found'); return; }
  try { const [file, type] = files[path]; const data = await readFile(`dist/${file}`); res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(500); res.end('Build output unavailable'); }
}).listen(Number(process.env.PORT || 5173), '127.0.0.1', () => console.log(`Gaji Survival: http://127.0.0.1:${process.env.PORT || 5173}`));
