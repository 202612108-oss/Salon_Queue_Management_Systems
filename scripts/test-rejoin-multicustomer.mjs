import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { db } from '../backend/dist/db/index.js';

const PORT = 5066;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch (e) {}
    await wait(300);
  }
  throw new Error('Server failed to start in time');
}

async function run() {
  console.log('--- Starting Multi-Customer No-show & Rejoin Verification ---');
  const backendProc = spawn(process.execPath, ['backend/dist/index.js'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: String(PORT) },
  });

  try {
    await waitForServer();
    console.log(`Backend server ready on port ${PORT}`);

    // Clean DB for pristine test run
    db.exec("DELETE FROM queue_entry_services;");
    db.exec("DELETE FROM queue_entries;");
    db.exec("UPDATE barbers SET status = 'Available';");
    db.prepare("UPDATE salon_settings SET value = '1' WHERE key = 'is_open'").run();
    db.prepare("UPDATE salon_settings SET value = '0' WHERE key = 'is_paused'").run();
    db.prepare("UPDATE salon_settings SET value = '23:59' WHERE key = 'closing_time'").run();

    // Get a valid service
    const srv = db.prepare("SELECT id FROM services WHERE active = 1 LIMIT 1").get();
    assert.ok(srv, 'Need at least 1 active service');

    // STEP 1: Add Customer 1 (Alice), Customer 2 (Bob), Customer 3 (Charlie)
    console.log('\nStep 1: Adding Alice, Bob, and Charlie...');
    const aliceRes = await fetchJson('/api/queue/join', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Alice Smith',
        customerPhone: '9800000001',
        serviceIds: [srv.id],
        preferredBarberId: null,
      }),
    });
    assert.equal(aliceRes.status, 201);
    assert.equal(aliceRes.data.entry.tokenNumber, 'S-1');
    assert.equal(aliceRes.data.entry.position, 1);
    const aliceId = aliceRes.data.entry.id;

    await wait(20);
    const bobRes = await fetchJson('/api/queue/join', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Bob Jones',
        customerPhone: '9800000002',
        serviceIds: [srv.id],
        preferredBarberId: null,
      }),
    });
    assert.equal(bobRes.status, 201);
    assert.equal(bobRes.data.entry.tokenNumber, 'S-2');
    assert.equal(bobRes.data.entry.position, 2);

    await wait(20);
    const charlieRes = await fetchJson('/api/queue/join', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Charlie Brown',
        customerPhone: '9800000003',
        serviceIds: [srv.id],
        preferredBarberId: null,
      }),
    });
    assert.equal(charlieRes.status, 201);
    assert.equal(charlieRes.data.entry.tokenNumber, 'S-3');
    assert.equal(charlieRes.data.entry.position, 3);

    console.log('✔ Initial queue created: S-1 (Alice, pos 1), S-2 (Bob, pos 2), S-3 (Charlie, pos 3)');

    // STEP 2: Call Alice (S-1)
    console.log('\nStep 2: Calling Alice (S-1)...');
    const callRes = await fetchJson('/api/reception/call-next', { method: 'POST' });
    assert.equal(callRes.status, 200);
    assert.equal(callRes.data.calledCustomer.tokenNumber, 'S-1');
    console.log(`✔ Alice (S-1) called for barber: ${callRes.data.assignedBarber.name}`);

    // STEP 3: Fast-forward 15 minutes and mark Alice as No-show
    console.log('\nStep 3: Simulating 15 minutes elapsed and marking Alice as No-show...');
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    db.prepare("UPDATE queue_entries SET called_at = ? WHERE id = ?").run(fifteenMinAgo, aliceId);

    const noShowRes = await fetchJson(`/api/reception/no-show/${aliceId}`, { method: 'POST' });
    assert.equal(noShowRes.status, 200);
    assert.equal(noShowRes.data.success, true);
    console.log('✔ Alice marked as No-show successfully.');

    // Check dashboard after No-show
    let dash = await fetchJson('/api/reception/dashboard');
    assert.equal(dash.data.waitingList.length, 2);
    assert.equal(dash.data.waitingList[0].tokenNumber, 'S-2'); // Bob is now 1st
    assert.equal(dash.data.waitingList[1].tokenNumber, 'S-3'); // Charlie is 2nd
    console.log('✔ Waiting list correctly shows Bob (S-2) at pos 1, Charlie (S-3) at pos 2');

    // STEP 4: Alice rejoins via Walk-in
    console.log('\nStep 4: Alice arrives and rejoins via Walk-in...');
    const aliceRejoinRes = await fetchJson('/api/reception/walk-in', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Alice Smith',
        customerPhone: '9800000001',
        serviceIds: [srv.id],
        preferredBarberId: null,
      }),
    });
    assert.equal(aliceRejoinRes.status, 201);
    const newAliceToken = aliceRejoinRes.data.entry.tokenNumber;
    const newAliceId = aliceRejoinRes.data.entry.id;

    // Verify Alice received a BRAND-NEW TOKEN
    assert.notEqual(newAliceToken, 'S-1', 'Must not reuse old token S-1');
    assert.equal(newAliceToken, 'S-4', 'Must receive sequential next token S-4');
    console.log(`✔ Alice received new token: ${newAliceToken} (expected S-4)`);

    // STEP 5: Verify Alice is at the END of the queue across all views
    console.log('\nStep 5: Verifying Alice is at the END of the queue across all views...');

    // 5A: Check Reception Dashboard
    dash = await fetchJson('/api/reception/dashboard');
    console.log('Reception Waiting List:');
    console.table(dash.data.waitingList.map((e, i) => ({ pos: i + 1, token: e.tokenNumber, name: e.customerName, status: e.status })));

    assert.equal(dash.data.waitingList.length, 3);
    assert.equal(dash.data.waitingList[0].tokenNumber, 'S-2', 'Pos 1 must be Bob');
    assert.equal(dash.data.waitingList[1].tokenNumber, 'S-3', 'Pos 2 must be Charlie');
    assert.equal(dash.data.waitingList[2].tokenNumber, 'S-4', 'Pos 3 (END) must be Alice');
    console.log('✔ Reception Dashboard confirms Alice is at pos 3 (END of the queue)');

    // 5B: Check TV Display (/api/display)
    const tvRes = await fetchJson('/api/display');
    console.log('\nTV Display Next Five:');
    console.table(tvRes.data.nextFive.map(e => ({ pos: e.position, token: e.tokenNumber, name: e.customerName })));

    assert.equal(tvRes.data.nextFive[0].tokenNumber, 'S-2', 'TV Pos 1 must be Bob');
    assert.equal(tvRes.data.nextFive[1].tokenNumber, 'S-3', 'TV Pos 2 must be Charlie');
    assert.equal(tvRes.data.nextFive[2].tokenNumber, 'S-4', 'TV Pos 3 (END) must be Alice');
    console.log('✔ Waiting Area TV confirms Alice is at pos 3 (END of the queue)');

    // 5C: Check Customer Status Screen (/api/queue/:id)
    const aliceStatus = await fetchJson(`/api/queue/${newAliceId}`);
    assert.equal(aliceStatus.data.position, 3, 'Customer status must report position 3');
    assert.equal(aliceStatus.data.tokenNumber, 'S-4');
    console.log(`✔ Alice /status/:id position is ${aliceStatus.data.position} (strictly NOT position 1)`);

    // STEP 6: Additional test with customers In Chair and Called
    console.log('\nStep 6: Testing scenario with customers In Chair and Called...');
    // Bob (S-2) is called and starts service (In Chair)
    const callBob = await fetchJson('/api/reception/call-next', { method: 'POST' });
    assert.equal(callBob.data.calledCustomer.tokenNumber, 'S-2');
    const startBob = await fetchJson(`/api/barber/${callBob.data.assignedBarber.id}/start`, {
      method: 'POST',
    });
    assert.equal(startBob.status, 200);

    // Charlie (S-3) is called (status: Called)
    const callCharlie = await fetchJson('/api/reception/call-next', { method: 'POST' });
    assert.equal(callCharlie.data.calledCustomer.tokenNumber, 'S-3');

    // Charlie does not arrive -> mark No-show
    const charlieFifteenAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    db.prepare("UPDATE queue_entries SET called_at = ? WHERE id = ?").run(charlieFifteenAgo, callCharlie.data.calledCustomer.id);
    const noShowCharlie = await fetchJson(`/api/reception/no-show/${callCharlie.data.calledCustomer.id}`, { method: 'POST' });
    assert.equal(noShowCharlie.status, 200);

    // Charlie rejoins online
    const charlieRejoin = await fetchJson('/api/queue/join', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Charlie Brown',
        customerPhone: '9800000003',
        serviceIds: [srv.id],
        preferredBarberId: null,
      }),
    });
    assert.equal(charlieRejoin.status, 201);
    assert.equal(charlieRejoin.data.entry.tokenNumber, 'S-5', 'Charlie gets token S-5');

    // Alice is S-4, Charlie is S-5. Alice is at pos 1 of waiting, Charlie is at pos 2 (end)
    const charlieStatus = await fetchJson(`/api/queue/${charlieRejoin.data.entry.id}`);
    assert.equal(charlieStatus.data.position, 2, 'Charlie is behind Alice');
    assert.equal(charlieStatus.data.tokenNumber, 'S-5');
    console.log(`✔ Charlie rejoined with S-5, at position 2 behind Alice (pos 1), at the END of the queue`);

    console.log('\n======================================================');
    console.log('   ALL MULTI-CUSTOMER REJOIN TESTS PASSED (100%)      ');
    console.log('======================================================\n');
  } finally {
    backendProc.kill();
  }
}

run();
