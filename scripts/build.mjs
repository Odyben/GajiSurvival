import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const html = await readFile('index.html', 'utf8');
const css = await readFile('src/style.css', 'utf8') + '\n' + await readFile('src/theme.css', 'utf8');
const finance = stripTypeScriptTypes(await readFile('src/finance.ts', 'utf8')).replace(/^export /gm, '');
const app = await readFile('src/main.js', 'utf8');
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html.replace('/* APP_CSS */', () => css).replace('/* APP_JS */', () => `(()=>{\n${finance}\n${app}\n})();`));
console.log('Built dist/index.html — self-contained, no runtime dependencies.');
