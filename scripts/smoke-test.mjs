import assert from 'node:assert/strict';
import { createLearner } from './lab-client.mjs';

const origin = process.env.MACOFU_TEST_URL || 'http://127.0.0.1:5080';
const { request } = createLearner();
async function snapshot() { return (await request('/api/state')).body; }
async function until(predicate) {
  for (let i = 0; i < 50; i++) {
    const state = await snapshot();
    if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Expected state was not reached in 5 seconds');
}
await request('/api/reset', 'POST');
try {
  let state = await snapshot();
  assert.equal(state.route, 'direct');
  assert.equal(state.databaseOnline, false);
  const rejected = await request('/api/orders', 'POST');
  assert.equal(rejected.status, 503);
  state = await snapshot();
  assert.equal(state.queue.length, 0);
  assert.equal(state.orders.length, 0);
  assert.equal(state.rejected, 1);

  await request('/api/route/queue', 'POST');
  const orders = await Promise.all(Array.from({ length: 3 }, () => request('/api/orders', 'POST')));
  assert(orders.every(order => order.status === 202));
  await new Promise(resolve => setTimeout(resolve, 900));
  state = await snapshot();
  assert.equal(state.queue.length, 3, 'Outage must not discard or consume queued work');
  assert.equal(state.orders.length, 0);
  assert.equal(state.mission.protectedCount, 3);
  assert.equal(state.mission.complete, false);
  assert.equal((await request(`/api/orders/${orders[0].body.orderId}`)).status, 404);

  await request('/api/worker/pause', 'POST');
  await request('/api/database/online', 'POST');
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.equal((await snapshot()).queue.length, 3, 'Restoring the database does not unpause the worker');
  await request('/api/worker/resume', 'POST');
  state = await until(state => state.mission.complete);
  assert.equal(state.orders.length, 3);
  assert.equal(state.queue.length, 0);
  assert.equal(state.mission.delivered, 3);
  assert.equal(new Set(state.orders.map(order => order.id)).size, 3);
  for (const order of orders) {
    assert.equal((await request(`/api/orders/${order.body.orderId}`)).status, 200);
    const events = state.events.filter(event => event.traceId === order.body.traceId);
    assert.deepEqual(events.map(event => event.kind), ['request', 'enqueued', 'accepted', 'consumed', 'saved', 'completed']);
  }
  console.log('PASS: direct outage failure, accepted queued orders, paused worker, recovery, all 3 protected orders delivered.');

  await request('/api/reset', 'POST');
  await request('/api/database/online', 'POST');
  const direct = await request('/api/orders', 'POST');
  assert.equal(direct.status, 201);
  state = await snapshot();
  assert.equal(state.orders.length, 1);
  assert.equal(state.mission.protectedCount, 0);
  assert.equal(state.mission.complete, false, 'Ordinary successful writes must not win the outage challenge');
  await request('/api/database/offline', 'POST');
  await request('/api/route/queue', 'POST');
  for (let i = 0; i < 30; i++) assert.equal((await request('/api/orders', 'POST')).status, 202);
  assert.equal((await request('/api/orders', 'POST')).status, 429);
  assert.equal((await snapshot()).queue.length, 30);
  assert.equal((await request('/api/route/invalid', 'POST')).status, 400);
  assert.equal((await request('/api/database/invalid', 'POST')).status, 400);
  assert.equal((await request('/api/worker/invalid', 'POST')).status, 400);
  assert.equal((await fetch(origin + '/api/source/queue')).status, 200);
  assert.equal((await fetch(origin + '/api/source/unknown')).status, 404);
  console.log('PASS: direct success, win-condition integrity, queue capacity, control validation, source allowlist.');

  const invalidMission = await request('/api/missions/unknown', 'POST');
  assert.equal(invalidMission.status, 400);
  assert.equal((await snapshot()).queue.length, 30, 'Invalid missions must not reset the lab');
  state = (await request('/api/missions/missing-order', 'POST')).body;
  const missingId = state.mission.targetOrderId;
  assert.equal(state.mission.id, 'missing-order');
  assert.equal(state.databaseOnline, true);
  assert.equal(state.paused, true);
  assert.equal(state.route, 'queue');
  assert.equal(state.mission.target, 1);
  assert.equal(state.queue.length, 1);
  assert.equal(state.queue[0].id, missingId);
  assert.equal(state.orders.length, 0);
  assert.equal(state.mission.complete, false);
  assert.equal((await request(`/api/orders/${missingId}`)).status, 404);
  let journey = (await request(`/api/journeys/${missingId}`)).body;
  assert.equal(journey.httpStatus, 202);
  assert.equal(journey.location, 'queue');
  assert.equal(journey.paused, true);
  assert.deepEqual(journey.events.map(event => event.kind), ['request', 'enqueued', 'accepted']);
  assert(journey.events.every(event => event.traceId === state.queue[0].traceId));
  assert.equal((await request('/api/journeys/unknown')).status, 404);

  await request('/api/route/direct', 'POST');
  const unrelated = await request('/api/orders', 'POST');
  assert.equal(unrelated.status, 201);
  assert.equal((await snapshot()).mission.complete, false, 'A different saved order cannot complete the missing-order mission');
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.equal((await request(`/api/orders/${missingId}`)).status, 404, 'The accepted order must remain missing while the worker is paused');
  // Keep the target journey intact even after the general event log rolls over.
  for (let i = 0; i < 70; i++) assert.equal((await request('/api/orders', 'POST')).status, 201);
  journey = (await request(`/api/journeys/${missingId}`)).body;
  assert.deepEqual(journey.events.map(event => event.kind), ['request', 'enqueued', 'accepted']);
  await request('/api/worker/resume', 'POST');
  state = await until(state => state.mission.complete);
  assert.equal(state.mission.delivered, 1);
  assert.equal((await request(`/api/orders/${missingId}`)).status, 200);
  journey = (await request(`/api/journeys/${missingId}`)).body;
  assert.equal(journey.httpStatus, 202, 'Delivery must retain the original acceptance receipt');
  assert.equal(journey.location, 'database');
  assert.deepEqual(journey.events.map(event => event.kind), ['request', 'enqueued', 'accepted', 'consumed', 'saved', 'completed']);
  assert(journey.events.every(event => event.traceId === journey.traceId));

  state = (await request('/api/reset', 'POST')).body;
  assert.equal(state.mission.id, 'missing-order', 'Restart keeps the selected mission');
  assert.equal(state.paused, true);
  assert.equal(state.queue.length, 1);
  assert.notEqual(state.mission.targetOrderId, missingId, 'Restart creates a new missing order');
  assert.equal(state.mission.complete, false);
  assert.equal((await request(`/api/journeys/${missingId}`)).status, 404, 'Restart clears prior order evidence');
  console.log('PASS: mission two setup, exact-order completion, live journey evidence, retained receipt, event retention, and mission restart.');
} finally {
  await request('/api/missions/rush-hour', 'POST');
}
const clean = await snapshot();
assert.equal(clean.paused, false);
assert.equal(clean.route, 'direct');
assert.equal(clean.databaseOnline, false);
assert.deepEqual(clean.queue, []);
assert.deepEqual(clean.orders, []);
assert.deepEqual(clean.events, []);
assert.equal(clean.mission.protectedCount, 0);
console.log('PASS: restart restores the opening puzzle.');
