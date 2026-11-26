// Builds the terminal as ONE self-contained HTML file (JS and CSS inlined),
// for hosts that serve a page without its sibling files, such as sandboxed
// previews. Output: dist-single/vantage.html
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist-single');

await build({
  root,
  configFile: false,
  base: './',
  plugins: [react()],
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: {
      input: resolve(root, 'terminal.html'),
      output: { inlineDynamicImports: true },
    },
  },
});

const assets = resolve(out, 'assets');
let html = readFileSync(resolve(out, 'terminal.html'), 'utf8');
const read = (f) => readFileSync(resolve(assets, f), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)"[^>]*>/g, (_, f) => `<style>${read(f)}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*><\/script>/g, '');
const scripts = readdirSync(assets).filter((f) => f.endsWith('.js'));
if (scripts.length !== 1) throw new Error(`expected one JS bundle, got ${scripts.join(', ')}`);
const js = read(scripts[0]).replace(/<\/script/gi, '<\\/script');
// module scripts run after parsing, so placing it at the end of body is equivalent
html = html.replace('</body>', () => `<script type="module">${js}</script>\n</body>`);

rmSync(assets, { recursive: true });
rmSync(resolve(out, 'terminal.html'));
writeFileSync(resolve(out, 'vantage.html'), html);
console.log(`dist-single/vantage.html  ${(html.length / 1024).toFixed(0)} kB`);
