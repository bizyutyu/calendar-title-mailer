import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// GAS はトリガー実行・エディタからの手動実行の対象関数が、
// グローバルスコープのトップレベルに安定した名前で存在することを要求する。
// bundle:true は全体を IIFE で包むため export した関数がトップレベルに現れない。
// globalName で IIFE の戻り値（export 群）を受け取り、footer でトップレベルの
// 薄いラッパー関数として再公開することで、エディタの実行ドロップダウンとトリガーの
// 両方から解決できるようにする。
const entryFunctions = ['runDailyMailer', 'setupDailyTrigger'];

await build({
  entryPoints: [path.join(rootDir, 'src', 'main.ts')],
  bundle: true,
  outfile: path.join(distDir, 'main.js'),
  format: 'iife',
  globalName: '__gasEntry',
  target: 'es2021',
  platform: 'neutral',
  footer: {
    js: entryFunctions
      .map((name) => `function ${name}() { return __gasEntry.${name}.apply(this, arguments); }`)
      .join('\n'),
  },
});

cpSync(path.join(rootDir, 'appsscript.json'), path.join(distDir, 'appsscript.json'));

console.log('Build complete: dist/main.js, dist/appsscript.json');
