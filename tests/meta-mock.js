// WalimApp AI — hermetic Meta mock test (no dependencies, offline).
// Starts a tiny mock Meta server, spawns server.js against it, verifies live
// ranking, secret-safe per-call logging, and HTTP 500 fallback. Only calls
// /api/ai/rank, so data/inquiries.json is never touched.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK_KEY = 'mock-key-for-test-only';
const PROMPT = 'I need an elegant wedding hall in Algiers for 250 guests, with parking and catering, budget 450000 DZD';
let failures = 0;
let force500 = false;

function check(name, cond, extra) {
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function post(p, body) {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

function waitForHealth(proc, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      if (proc.exitCode != null) return reject(new Error('server exited early'));
      fetch(`${BASE}/api/health`)
        .then((r) => (r.ok ? resolve() : retry()))
        .catch(retry);
      function retry() {
        if (Date.now() - start > timeoutMs) return reject(new Error('health timeout'));
        setTimeout(poll, 250);
      }
    })();
  });
}

function extractHallIds(body) {
  const msgs = body && Array.isArray(body.messages) ? body.messages : [];
  const user = msgs.find((m) => m && m.role === 'user' && typeof m.content === 'string');
  const content = user ? user.content : '';
  const marker = 'Halls: ';
  const idx = content.indexOf(marker);
  if (idx < 0) return [];
  try {
    const arr = JSON.parse(content.slice(idx + marker.length).trim());
    if (Array.isArray(arr)) return arr.map((h) => h && h.id).filter((id) => typeof id === 'string');
  } catch { /* fall through */ }
  return [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const mock = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    if (req.headers.authorization !== `Bearer ${MOCK_KEY}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    if (force500) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'mock_failure' }));
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let ids = [];
      try {
        ids = extractHallIds(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch { ids = []; }
      const ranking = ids.map((id, i) => ({
        id,
        score: Math.max(1, 90 - i * 5),
        reason: `Mock reason for ${id}: fits 250 guests in Algiers with parking and catering.`,
      }));
      ranking.push({ id: 'h-does-not-exist', score: 99, reason: 'x' });
      const payload = { choices: [{ message: { content: JSON.stringify({ ranking }) } }] };
      const out = Buffer.from(JSON.stringify(payload));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': out.length });
      res.end(out);
    });
  });
  await new Promise((resolve, reject) => {
    mock.once('error', reject);
    mock.listen(0, '127.0.0.1', () => resolve());
  });
  const mockPort = mock.address().port;
  const mockBase = `http://127.0.0.1:${mockPort}/v1`;

  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), MODEL_API_KEY: MOCK_KEY, META_API_KEY: '', META_API_BASE: mockBase },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  if (server.stdout) server.stdout.on('data', (c) => { stdout += c.toString(); });
  if (server.stderr) server.stderr.on('data', (c) => { stderr += c.toString(); });
  const kill = () => {
    if (server.exitCode == null) server.kill();
  };
  const closeMock = () => new Promise((resolve) => {
    try {
      mock.close(() => resolve());
    } catch { resolve(); }
  });
  process.on('exit', kill);
  setTimeout(() => {
    console.log('TIMEOUT — forcing exit');
    kill();
    try { mock.close(); } catch { /* best effort */ }
    process.exit(2);
  }, 90000).unref();

  try {
    await waitForHealth(server);
    check('health', true);

    const hallsSeed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'halls.json'), 'utf8')).halls;
    const seedIds = new Set(hallsSeed.map((h) => h.id));

    const r1 = await post('/api/ai/rank', { prompt: PROMPT, lang: 'en' });
    check('live-mode', r1.status === 200 && r1.json.mode === 'live', JSON.stringify(r1.json).slice(0, 200));
    check('live-model', r1.json.model === 'muse-spark-1.3', JSON.stringify(r1.json.model));
    const ranking1 = Array.isArray(r1.json.ranking) ? r1.json.ranking : [];
    const halls1 = Array.isArray(r1.json.halls) ? r1.json.halls : [];
    const rankIds1 = ranking1.map((r) => r && r.id);
    const hallIds1 = halls1.map((h) => h && h.id);
    check('rank-nonempty', ranking1.length >= 1, `count=${ranking1.length}`);
    check(
      'rank-ids-exist',
      rankIds1.every((id) => seedIds.has(id)) && hallIds1.every((id) => seedIds.has(id)),
      JSON.stringify(rankIds1)
    );
    check(
      'fake-filtered',
      !rankIds1.includes('h-does-not-exist') && !hallIds1.includes('h-does-not-exist'),
      JSON.stringify(rankIds1)
    );
    check(
      'reasons-from-mock',
      ranking1.length >= 1 && ranking1.every((r) => typeof r.reason === 'string' && r.reason.includes('Mock')),
      JSON.stringify(ranking1.map((r) => r.reason).slice(0, 2))
    );
    check(
      'scores-int-range',
      ranking1.length >= 1 && ranking1.every((r) => Number.isInteger(r.score) && r.score >= 0 && r.score <= 100),
      JSON.stringify(ranking1.map((r) => r.score))
    );

    await sleep(500);
    check(
      'meta-log-200',
      stdout.includes('[meta] POST /chat/completions model=muse-spark-1.3 -> HTTP 200 in'),
      stdout.slice(-500)
    );
    check('no-key-leak', !stdout.includes(MOCK_KEY) && !stderr.includes(MOCK_KEY));

    force500 = true;
    const r2 = await post('/api/ai/rank', { prompt: PROMPT, lang: 'en' });
    check('cached-after-500', r2.status === 200 && r2.json.mode === 'cached', JSON.stringify(r2.json).slice(0, 200));
    check('fallback-500', r2.json.fallbackReason === 'http_500', JSON.stringify(r2.json.fallbackReason));
    check('model-not-spark', r2.json.model !== 'muse-spark-1.3', JSON.stringify(r2.json.model));

    await sleep(500);
    check('meta-log-500', stdout.includes('-> HTTP 500 in'), stdout.slice(-500));
    check('no-key-leak-after-500', !stdout.includes(MOCK_KEY) && !stderr.includes(MOCK_KEY));
  } catch (err) {
    failures += 1;
    console.log(`FAIL exception — ${err && err.message}`);
  } finally {
    kill();
    await closeMock();
    await sleep(200);
  }
  console.log(failures ? `${failures} FAILURES` : 'ALL META MOCK TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
