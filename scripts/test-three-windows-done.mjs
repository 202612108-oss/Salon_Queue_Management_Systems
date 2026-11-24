import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { db } from '../backend/dist/db/index.js';

const PORT = 5088;
const BASE_URL = `http://localhost:${PORT}`;

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
    } catch (e) {
      if (i === maxAttempts - 1) {
        console.error('Final health check error:', e);
      }
    }
    await wait(300);
  }
  throw new Error('Server failed to start in time');
}

/**
 * Simulates a Browser Window with its Socket.IO connection and React state updates.
 */
class BrowserWindowSimulation {
  constructor(name, socketUrl) {
    this.name = name;
    this.socketUrl = socketUrl;
    this.socket = null;
    this.state = {};
    this.eventLog = [];
    this.lastUpdatedTimestamp = 0;
  }

  async connect() {
    this.socket = io(this.socketUrl, { transports: ['websocket', 'polling'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${this.name} socket connect timeout`)), 5000);
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  recordEvent(eventName, data) {
    this.lastUpdatedTimestamp = Date.now();
    this.eventLog.push({ eventName, data, time: this.lastUpdatedTimestamp });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

async function run() {
  console.log('================================================================');
  console.log('TEST: Real-Time Multi-Window Updates on Barber "Done" Action');
  console.log('Simulating 3 Independent Browser Windows:');
  console.log('  - Window 1: Customer Status Screen (/status/:id)');
  console.log('  - Window 2: Waiting Area TV Display (/display)');
  console.log('  - Window 3: Barber View Station (/barber/:name)');
  console.log('================================================================\n');

  const backendProc = spawn(process.execPath, ['backend/dist/index.js'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PORT: String(PORT) },
  });

  const win1Customer = new BrowserWindowSimulation('Window 1 (Customer Status)', BASE_URL);
  const win2TV = new BrowserWindowSimulation('Window 2 (Waiting Area TV)', BASE_URL);
  const win3Barber = new BrowserWindowSimulation('Window 3 (Barber View)', BASE_URL);

  try {
    await waitForServer();
    console.log(`[Setup] Backend started successfully on port ${PORT}`);

    // Database reset
    db.exec("DELETE FROM queue_entry_services;");
    db.exec("DELETE FROM queue_entries;");
    db.exec("UPDATE barbers SET status = 'Available';");
    db.prepare("UPDATE salon_settings SET value = '1' WHERE key = 'is_open'").run();
    db.prepare("UPDATE salon_settings SET value = '0' WHERE key = 'is_paused'").run();
    db.prepare("UPDATE salon_settings SET value = '23:59' WHERE key = 'closing_time'").run();

    // 1. Connect all 3 windows
    await Promise.all([win1Customer.connect(), win2TV.connect(), win3Barber.connect()]);
    console.log('[Setup] All 3 simulated browser windows connected to Socket.IO\n');

    // Step A: Customer Joins Queue
    const srv = db.prepare("SELECT id FROM services WHERE active = 1 LIMIT 1").get();
    const joinRes = await fetchJson('/api/queue/join', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Aarav Patel',
        customerPhone: '9820012345',
        serviceIds: [srv.id],
        preferredBarberId: null,
      }),
    });
    assert.equal(joinRes.status, 201);
    const entryId = joinRes.data.entry.id;
    const tokenNumber = joinRes.data.entry.tokenNumber || joinRes.data.entry.token_number;
    console.log(`[Step 1] Aarav joined queue with token ${tokenNumber} (ID: ${entryId})`);

    // Step B: Reception Calls Next
    const callRes = await fetchJson('/api/reception/call-next', { method: 'POST' });
    assert.equal(callRes.status, 200);
    const assignedBarber = callRes.data.assignedBarber;
    const stationNum = assignedBarber.stationNumber || assignedBarber.station_number;
    console.log(`[Step 2] Reception called ${tokenNumber} to Barber ${assignedBarber.name} (Station ${stationNum})`);

    // Step C: Barber Starts Service -> In Chair
    const startRes = await fetchJson(`/api/barber/${assignedBarber.id}/start`, { method: 'POST' });
    assert.equal(startRes.status, 200);
    console.log(`[Step 3] Barber ${assignedBarber.name} started service -> Status: In Chair\n`);

    // Fetch initial state for each window
    const initialCustData = await fetchJson(`/api/queue/${entryId}`);
    win1Customer.state = initialCustData.data;
    assert.equal(win1Customer.state.status, 'In Chair');

    const initialTvData = await fetchJson('/api/display');
    win2TV.state = initialTvData.data;
    const tvStationBefore = win2TV.state.nowServing.find(s => s.barberId === assignedBarber.id);
    assert.equal(tvStationBefore.currentCustomer?.tokenNumber, tokenNumber);

    const barberSlug = assignedBarber.slug || assignedBarber.name.toLowerCase();
    const initialBarberData = await fetchJson(`/api/barber/details/${barberSlug}`);
    win3Barber.state = initialBarberData.data;
    assert.equal(win3Barber.state.barber.status, 'Busy');
    assert.equal(win3Barber.state.currentCustomer?.id, entryId);

    console.log('[Initial Window States Verified]');
    console.log(` - Window 1 (Customer): Aarav status = "${win1Customer.state.status}"`);
    console.log(` - Window 2 (TV): Station ${stationNum} serving = "${tvStationBefore.currentCustomer?.tokenNumber}"`);
    console.log(` - Window 3 (Barber): Station status = "${win3Barber.state.barber.status}", customer = "${win3Barber.state.currentCustomer?.customerName || win3Barber.state.currentCustomer?.customer_name}"\n`);

    // Attach listeners corresponding to the updated frontend components
    // Window 1: StatusPage.tsx listeners
    win1Customer.socket.on('queue:updated', async () => {
      const refreshed = await fetchJson(`/api/queue/${entryId}`);
      win1Customer.state = refreshed.data;
      win1Customer.recordEvent('queue:updated', refreshed.data);
    });
    win1Customer.socket.on('service:completed', async (data) => {
      win1Customer.recordEvent('service:completed', data);
      const refreshed = await fetchJson(`/api/queue/${entryId}`);
      win1Customer.state = refreshed.data;
    });

    // Window 2: DisplayPage.tsx listeners
    win2TV.socket.on('queue:updated', async () => {
      const refreshed = await fetchJson('/api/display');
      win2TV.state = refreshed.data;
      win2TV.recordEvent('queue:updated', refreshed.data);
    });
    win2TV.socket.on('service:completed', async (data) => {
      win2TV.recordEvent('service:completed', data);
      const refreshed = await fetchJson('/api/display');
      win2TV.state = refreshed.data;
    });

    // Window 3: BarberPage.tsx listeners
    win3Barber.socket.on('queue:updated', async () => {
      const refreshed = await fetchJson(`/api/barber/details/${barberSlug}`);
      win3Barber.state = refreshed.data;
      win3Barber.recordEvent('queue:updated', refreshed.data);
    });
    win3Barber.socket.on('service:completed', async (data) => {
      win3Barber.recordEvent('service:completed', data);
      const refreshed = await fetchJson(`/api/barber/details/${barberSlug}`);
      win3Barber.state = refreshed.data;
    });
    win3Barber.socket.on('barber:status_changed', async (data) => {
      win3Barber.recordEvent('barber:status_changed', data);
      const refreshed = await fetchJson(`/api/barber/details/${barberSlug}`);
      win3Barber.state = refreshed.data;
    });

    // Step D: Barber Clicks Done
    console.log('>>> [Action] Barber clicks "Done" (POST /api/barber/:id/done)...');
    const startTime = Date.now();
    const doneRes = await fetchJson(`/api/barber/${assignedBarber.id}/done`, { method: 'POST' });
    assert.equal(doneRes.status, 200);

    // Wait and verify real-time propagation across all three windows (must be <= 5000ms)
    let allUpdated = false;
    let elapsed = 0;
    while (elapsed < 5000) {
      await wait(100);
      elapsed = Date.now() - startTime;

      const win1Done = win1Customer.state?.status === 'Done';
      const tvStation = win2TV.state?.nowServing?.find(s => s.barberId === assignedBarber.id);
      const win2Clear = tvStation && tvStation.currentCustomer === null;
      const win3Avail = win3Barber.state?.barber?.status === 'Available' && win3Barber.state?.currentCustomer === null;

      if (win1Done && win2Clear && win3Avail) {
        allUpdated = true;
        break;
      }
    }

    console.log(`\n[Results after ${elapsed} ms]:`);
    console.log(` - Window 1 (Customer Status): Status is "${win1Customer.state?.status}" (Updated: ${win1Customer.state?.status === 'Done'})`);
    console.log(` - Window 2 (Waiting Area TV): Station ${assignedBarber.station_number} customer is null (Cleared: ${win2TV.state?.nowServing?.find(s => s.barberId === assignedBarber.id)?.currentCustomer === null})`);
    console.log(` - Window 3 (Barber View): Barber status is "${win3Barber.state?.barber?.status}", currentCustomer = ${win3Barber.state?.currentCustomer} (Ready: ${win3Barber.state?.barber?.status === 'Available'})`);

    assert.ok(allUpdated, `All 3 windows should update within 5 seconds without manual refresh (elapsed: ${elapsed}ms)`);
    assert.ok(elapsed <= 5000, `Update took ${elapsed}ms which is <= 5000ms`);

    console.log(`\n✔ PASS: All 3 windows updated automatically in ${elapsed}ms (< 5.0 seconds)!`);
    console.log('Window 1 Events:', win1Customer.eventLog.map(e => e.eventName));
    console.log('Window 2 Events:', win2TV.eventLog.map(e => e.eventName));
    console.log('Window 3 Events:', win3Barber.eventLog.map(e => e.eventName));

  } finally {
    win1Customer.disconnect();
    win2TV.disconnect();
    win3Barber.disconnect();
    backendProc.kill();
  }
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
