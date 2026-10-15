import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { appIcon } from './icons.mjs';
const html = (await readFile('index.html', 'utf8')).replace('<!-- MONEY_TOOLS -->', await readFile('src/tools.html', 'utf8'));
const css = await readFile('src/style.css', 'utf8') + '\n' + await readFile('src/theme.css', 'utf8') + '\n' + await readFile('src/tools.css', 'utf8');
const finance = stripTypeScriptTypes(await readFile('src/finance.ts', 'utf8')).replace(/^export /gm, '');
const app = await readFile('src/tools.js', 'utf8') + '\n' + await readFile('src/main.js', 'utf8');
await mkdir('dist', { recursive: true });
const output = html.replace('/* APP_CSS */', () => css).replace('/* APP_JS */', () => `(()=>{\n${finance}\n${app}\n})();`);
await writeFile('dist/index.html', output);
const manifest = await readFile('src/manifest.webmanifest', 'utf8');
const worker = await readFile('src/sw.js', 'utf8');
const icons = [appIcon(192), appIcon(512)];
const hash = createHash('sha256').update(output).update(manifest).update(worker).update(icons[0]).update(icons[1]).digest('hex').slice(0, 12);
await Promise.all([
  writeFile('dist/manifest.webmanifest', manifest),
  writeFile('dist/sw.js', worker.replace('__BUILD__', hash)),
  writeFile('dist/icon-192.png', icons[0]),
  writeFile('dist/icon-512.png', icons[1])
]);
console.log('Built dist/index.html — self-contained, no runtime dependencies.');
