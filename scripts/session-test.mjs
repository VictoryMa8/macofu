import assert from 'node:assert/strict';
import { createLearner } from './lab-client.mjs';

const origin = process.env.MACOFU_TEST_URL || 'http://127.0.0.1:5080';
const a = createLearner(), b = createLearner();
const state = async learner => (await learner.request('/api/state')).body;
async function until(learner, predicate) {
  for (let i = 0; i < 50; i++) {
    const current = await state(learner);
    if (predicate(current)) return current;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Expected learner state was not reached in 5 seconds');
}

for (const path of ['/healthz', '/api/source/handler', '/lesson.html']) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null, `${path} does not allocate a factory`);
  await response.arrayBuffer();
}
const first = await Promise.all([a.request('/api/state'), b.request('/api/state')]);
assert.notEqual(a.cookie, b.cookie, 'Different browsers get different factories');
for (const result of first) {
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const cookie = result.headers.get('set-cookie');
  assert.match(cookie, /macofu-learner=[A-F0-9]{64};/);
  assert.match(cookie, /httponly/i);
  assert.match(cookie, /samesite=strict/i);
  assert.match(cookie, /path=\/api/i);
  assert.deepEqual(result.body.queue, []);
}
const secure = await fetch(origin + '/api/state', { headers: { 'X-Forwarded-Proto': 'https' } });
assert.match(secure.headers.get('set-cookie'), /; secure/i, 'HTTPS behind Fly issues a Secure cookie');
await secure.arrayBuffer();
const forged = createLearner('macofu-learner=caller-chosen-identity');
await forged.request('/api/state');
assert.notEqual(forged.cookie, 'macofu-learner=caller-chosen-identity', 'Unknown cookies receive a new server identity');

await a.request('/api/route/queue', 'POST');
await a.request('/api/worker/pause', 'POST');
const accepted = await Promise.all(Array.from({ length: 3 }, () => a.request('/api/orders', 'POST')));
assert(accepted.every(order => order.status === 202));
const aWaiting = await state(a);
assert.equal(aWaiting.mission.protectedCount, 3);
assert.deepEqual(await state(b), first[1].body, 'A controls and submissions do not affect B');
for (const order of accepted) {
  assert.equal((await b.request(`/api/orders/${order.body.orderId}`)).status, 404);
  assert.equal((await b.request(`/api/journeys/${order.body.orderId}`)).status, 404);
}

let bState = (await b.request('/api/missions/missing-order', 'POST')).body;
const target = bState.mission.targetOrderId;
assert.deepEqual(await state(a), aWaiting, 'B mission changes do not reset A');
assert.equal((await a.request(`/api/journeys/${target}`)).status, 404);
assert.equal((await a.request(`/api/journeys/${target}/diagnosis/worker-paused`, 'POST')).status, 404);
assert.equal((await a.request(`/api/journeys/${target}/verify`, 'POST')).status, 404);
await b.request('/api/orders', 'POST');
await b.request('/api/worker/resume', 'POST');
bState = await until(b, current => current.mission.delivered === 1 && current.queue.length === 0);
assert.equal(bState.orders.length, 2);
assert.equal((await b.request(`/api/journeys/${target}/verify`, 'POST')).status, 409, 'Saving early still requires a diagnosis');
const bReload = createLearner(b.cookie);
assert.equal((await bReload.request(`/api/journeys/${target}/diagnosis/worker-paused`, 'POST')).status, 200);
assert.equal((await state(b)).mission.diagnosed, true, 'Diagnosis after delivery persists across tabs');
bState = (await b.request(`/api/journeys/${target}/verify`, 'POST')).body;
assert.equal(bState.mission.complete, true);
assert.deepEqual(await state(a), aWaiting, 'B worker can deliver while A stays paused and offline');
assert.equal((await b.request(`/api/orders/${target}`)).status, 200);
assert.equal((await a.request(`/api/orders/${target}`)).status, 404, 'SQLite reads are isolated');

await a.request('/api/database/online', 'POST');
await a.request('/api/worker/resume', 'POST');
const aDone = await until(a, current => current.mission.complete);
assert.equal(aDone.orders.length, 3);
assert.equal(aDone.mission.delivered, 3);
assert.deepEqual(await state(b), bState, 'A completion never changes B progress or evidence');
for (const order of accepted) {
  assert.equal((await b.request(`/api/orders/${order.body.orderId}`)).status, 404);
}

await a.request('/api/reset', 'POST');
assert.deepEqual(await state(b), bState, 'A restart cannot delete B saved orders or evidence');
const aReset = await state(a);
await b.request('/api/reset', 'POST');
assert.deepEqual(await state(a), aReset, 'B restart cannot change A');
assert.notEqual((await state(b)).mission.targetOrderId, target);

const sameBrowser = createLearner(a.cookie);
await sameBrowser.request('/api/route/queue', 'POST');
const [newOrder] = await Promise.all([
  sameBrowser.request('/api/orders', 'POST'), b.request('/api/missions/rush-hour', 'POST')
]);
assert.equal(newOrder.status, 202);
assert.equal((await state(a)).queue[0].id, newOrder.body.orderId, 'Reloads and tabs retain the browser factory');
assert.equal((await a.request('/api/state')).headers.get('set-cookie'), null, 'Existing sessions retain their identity');
assert.deepEqual((await state(b)).queue, [], 'Concurrent mission reset stays isolated');
console.log('PASS: browser cookies, reload/tab continuity, concurrent learners, isolated controls, missions, orders, SQLite, journeys, exact-goal progress, workers, and restarts.');
