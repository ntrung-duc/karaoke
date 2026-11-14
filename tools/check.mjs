import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const excluded = new Set(['node_modules', '.git', '.codex', '.agents', 'source-assets', '.deploy-repo', '.vercel', 'dist']);
let checked = 0;
async function check(directory) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (/\.(?:mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', path], {stdio: 'inherit'});
      if (result.status !== 0) process.exit(result.status || 1);
      checked++;
    }
  }
}
await check(fileURLToPath(new URL('..', import.meta.url)));
console.log(`Syntax OK: ${checked} JavaScript files`);
