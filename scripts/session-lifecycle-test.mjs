import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createLearner } from './lab-client.mjs';

// Exercise cleanup and capacity on a short-lived server without changing the demo's settings.
const dll = process.env.MACOFU_TEST_DLL || fileURLToPath(new URL('../bin/Debug/net10.0/Macofu.dll', import.meta.url));
const server = spawn('dotnet', [dll, '--urls', 'http://127.0.0.1:0'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: { ...process.env, LearnerSessions__IdleTimeout: '00:00:02', LearnerSessions__MaxSessions: '2',
    Logging__LogLevel__Microsoft: 'Information' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
server.stderr.on('data', chunk => { output = (output + chunk).slice(-10000); });
try {
  const origin = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Test server did not start: ${output}`)), 15000);
    server.on('error', reject);
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Test server exited (${code}): ${output}`)); });
    server.stdout.on('data', chunk => {
      output = (output + chunk).slice(-10000);
      const address = output.match(/Now listening on: (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (address) { clearTimeout(timeout); resolve(address); }
    });
  });
  const a = createLearner('', origin), b = createLearner('', origin), c = createLearner('', origin);
  await a.request('/api/state');
  const oldCookie = a.cookie;
  await a.request('/api/database/online', 'POST');
  const saved = await a.request('/api/orders', 'POST');
  assert.equal(saved.status, 201);
  await b.request('/api/route/queue', 'POST');
  const bCookie = b.cookie;
  assert.equal((await c.request('/api/state')).status, 503, 'Capacity never evicts another learner');
  assert.equal((await c.request('/api/state')).headers.get('retry-after'), '60');
  assert.equal((await a.request(`/api/orders/${saved.body.orderId}`)).status, 200);
  for (const path of ['/healthz', '/api/source/handler']) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, 'Health and source stay available at session capacity');
    assert.equal(response.headers.get('set-cookie'), null);
    await response.arrayBuffer();
  }
  async function waitForSpace(learner) {
    for (let i = 0; i < 60; i++) {
      assert.equal((await b.request('/api/state')).status, 200);
      const result = await learner.request('/api/state');
      if (result.status === 200) return result.body;
      assert.equal(result.status, 503);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail('Idle sessions did not release their capacity');
  }
  await waitForSpace(c);
  assert.equal((await a.request('/api/state')).status, 503, 'An expired identity cannot reclaim another active factory');
  const fresh = await waitForSpace(a);
  assert.notEqual(a.cookie, oldCookie, 'An expired cookie is replaced with a new identity');
  assert.deepEqual(fresh.orders, []);
  assert.deepEqual(fresh.queue, []);
  assert.equal(fresh.databaseOnline, false);
  assert.equal((await a.request(`/api/orders/${saved.body.orderId}`)).status, 404);
  assert.equal((await a.request(`/api/journeys/${saved.body.orderId}`)).status, 404);
  assert.equal(b.cookie, bCookie, 'Active requests extend idle lifetime');
  assert.equal((await b.request('/api/state')).body.route, 'queue', 'Active learners retain their controls');
  console.log('PASS: idle expiry, fresh identities, reclaimed capacity, active-session retention, capacity response, and session-free health/source endpoints.');
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    const force = setTimeout(() => server.kill('SIGKILL'), 5000);
    await once(server, 'exit');
    clearTimeout(force);
  }
}
