// After mobile/build.mjs fills ../www, inject the Tauri desktop bridge into index.html.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const www = join(root, '..', 'www');
const bridgeSrc = join(root, 'tauri-desktop.js');
const bridgeDest = join(www, 'tauri-desktop.js');

copyFileSync(bridgeSrc, bridgeDest);

const indexPath = join(www, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('tauri-desktop.js')) {
  html = html.replace(
    '<script src="mobile-bridge.js"></script>',
    '<script src="mobile-bridge.js"></script>\n  <script src="tauri-desktop.js"></script>'
  );
  writeFileSync(indexPath, html);
}
console.log('www/ ready for Tauri (tauri-desktop.js injected)');
