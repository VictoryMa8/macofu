import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

// Verify web assets and source without changing another learner's factory.
const root = new URL('../wwwroot/', import.meta.url);
const origin = process.env.MACOFU_DEPLOY_URL || 'https://macofu.fly.dev';
const revision = process.env.GITHUB_SHA || Date.now().toString();
const hash = value => createHash('sha256').update(value).digest('hex');

async function readRemote(path) {
  const url = new URL(path, origin);
  url.searchParams.set('verify', revision);
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, `${path} responds successfully`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
const paths = entries.filter(entry => entry.isFile()).map(entry => {
  return relative(fileURLToPath(root), join(entry.parentPath, entry.name)).replaceAll('\\', '/');
}).sort();

for (const path of paths) {
  const [local, remote] = await Promise.all([
    fs.readFile(new URL(path, root)), readRemote(`/${path}`)
  ]);
  assert.equal(hash(remote), hash(local), `Live /${path} matches the checked-out commit`);
}

for (const [name, file] of Object.entries({ handler: 'Program.cs', queue: 'Lab.cs', worker: 'OrderWorker.cs', database: 'OrderStore.cs' })) {
  const [local, remote] = await Promise.all([
    fs.readFile(new URL(`../${file}`, import.meta.url)), readRemote(`/api/source/${name}`)
  ]);
  assert.equal(hash(remote), hash(local), `Live source inspector serves this commit's ${file}`);
}

const state = JSON.parse((await readRemote('/api/state')).toString());
assert(Array.isArray(state.queue) && Array.isArray(state.orders), 'Live lesson API returns its expected state');
const health = JSON.parse((await readRemote('/healthz')).toString());
assert.equal(health.status, 'ok', 'Session-free hosting health check is healthy');
console.log(`PASS: all ${paths.length} web assets and all 4 source files match this commit; live lesson API is healthy.`);
