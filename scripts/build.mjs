import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [path.join(rootDir, 'src', 'main.ts')],
  bundle: true,
  outfile: path.join(distDir, 'main.js'),
  format: 'iife',
  target: 'es2021',
  platform: 'neutral',
});

cpSync(path.join(rootDir, 'appsscript.json'), path.join(distDir, 'appsscript.json'));

console.log('Build complete: dist/main.js, dist/appsscript.json');
