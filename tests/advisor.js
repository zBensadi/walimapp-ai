// WalimApp AI — AI venue advisor test (no dependencies).
// Covers POST /api/owner/halls/:id/advisor: unauthenticated 401, customer
// 403, cross-owner 403, owner 200 with all 6 report sections, facts-vs-
// recommendations separation, DEMO/LIVE mode validation, and trilingual
// reports. Snapshots and restores data/*.json (exact raw bytes) so no test
// data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3105;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(__dirname, '..', 'data');
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json', 'halls.json'].map((f) => path.join(DATA, f));
const OWNER_EMAIL = 'owner@test.dz';
const OWNER_PASSWORD = 'OwnerPassword123!';
const OWNER_B_EMAIL = 'ownerb@test.dz';
const OWNER_B_PASSWORD = 'OwnerBPassword123!';
const CUSTOMER_EMAIL = 'advisor-customer@test.dz';
const CUSTOMER_PASSWORD = 'CustomerPassword123!';
const SECTIONS = ['strengths', 'galleryObservations', 'recommendedViews', 'listingImprovements', 'presentationTips', 'nextActions'];
let failures = 0;

function check(name, cond, extra) {
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function sessionCookieFrom(res) {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const headers = all && all.length ? all : [res.headers.get('set-cookie')].filter(Boolean);
  for (const header of headers) {
    const m = /^wa_session=([^;]*)/.exec(String(header).trim());
    if (m) return `wa_session=${m[1]}`;
  }
  return '';
}

async function get(p, cookie) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, { headers });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

async function post(p, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, raw: r };
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

function validReport(report) {
  if (!report || typeof report !== 'object') return false;
  return SECTIONS.every(
    (k) => Array.isArray(report[k]) && report[k].length > 0 && report[k].every((s) => typeof s === 'string' && s.trim().length > 0)
  );
}

(async () => {
  const snapshots = SNAP_FILES.map((f) => (fs.existsSync(f) ? fs.readFileSync(f) : null));
  const restore = () => {
    try {
      SNAP_FILES.forEach((f, i) => {
        if (snapshots[i] == null) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } else {
          fs.writeFileSync(f, snapshots[i]);
        }
      });
    } catch { /* best effort */ }
  };
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      MODEL_API_KEY: '',
      META_API_KEY: '',
      OWNER_EMAIL,
      OWNER_PASSWORD,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const kill = () => {
    if (server.exitCode == null) server.kill();
  };
  process.on('exit', kill);
  setTimeout(() => {
    console.log('TIMEOUT — forcing exit');
    kill();
    restore();
    process.exit(2);
  }, 120000).unref();

  try {
    await waitForHealth(server);
    check('health', true);

    const ownerLogin = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const jarA = ownerLogin.raw ? sessionCookieFrom(ownerLogin.raw) : '';
    check('owner-a-login', ownerLogin.status === 200 && !!jarA, JSON.stringify(ownerLogin.json).slice(0, 200));

    const listA = await get('/api/owner/halls', jarA);
    const hallA = (listA.json.halls || [])[0];
    check('owner-a-has-hall', listA.status === 200 && !!hallA && !!hallA.id, `count=${(listA.json.halls || []).length}`);
    const hallId = hallA && hallA.id;
    const advisorPath = `/api/owner/halls/${encodeURIComponent(hallId)}/advisor`;

    const anon = await post(advisorPath, { lang: 'fr' });
    check('advisor-anon-401', anon.status === 401 && anon.json.error === 'unauthorized', JSON.stringify(anon.json));

    const regC = await post('/api/auth/register', {
      fullName: 'Advisor Customer', email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD, confirmPassword: CUSTOMER_PASSWORD,
    });
    check('customer-register', regC.status === 201, JSON.stringify(regC.json).slice(0, 200));
    const jarC = regC.raw ? sessionCookieFrom(regC.raw) : '';
    const asCustomer = await post(advisorPath, { lang: 'fr' }, jarC);
    check('advisor-customer-403', asCustomer.status === 403 && asCustomer.json.error === 'forbidden', JSON.stringify(asCustomer.json));

    const regB = await post('/api/auth/register', {
      fullName: 'Owner B', email: OWNER_B_EMAIL, password: OWNER_B_PASSWORD, confirmPassword: OWNER_B_PASSWORD,
    });
    check('owner-b-register', regB.status === 201, JSON.stringify(regB.json).slice(0, 200));
    try {
      const usersFile = path.join(DATA, 'users.json');
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      const u = users.find((x) => x && x.email === OWNER_B_EMAIL);
      if (u) {
        u.role = 'owner';
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
      }
    } catch (err) {
      check('owner-b-promote', false, String(err && err.message));
    }
    const loginB = await post('/api/auth/login', { email: OWNER_B_EMAIL, password: OWNER_B_PASSWORD });
    const jarB = loginB.raw ? sessionCookieFrom(loginB.raw) : '';
    check('owner-b-login', loginB.status === 200 && !!jarB, JSON.stringify(loginB.json).slice(0, 200));

    const cross = await post(advisorPath, { lang: 'fr' }, jarB);
    check('advisor-cross-owner-403', cross.status === 403 && cross.json.error === 'forbidden', JSON.stringify(cross.json));

    const missing = await post('/api/owner/halls/does-not-exist/advisor', { lang: 'fr' }, jarA);
    check('advisor-missing-hall-404', missing.status === 404 && missing.json.error === 'hall_not_found', JSON.stringify(missing.json));

    const photos = ['https://example.com/p1.jpg', 'https://example.com/p2.jpg', 'https://example.com/p3.jpg'];
    const ok = await post(advisorPath, { selectedPhotos: photos, lang: 'fr' }, jarA);
    check('advisor-owner-200', ok.status === 200 && ok.json.hallId === hallId, `status=${ok.status} hallId=${ok.json.hallId}`);
    check('advisor-six-sections', validReport(ok.json.report), JSON.stringify(ok.json.report).slice(0, 300));

    const facts = ok.json.facts || {};
    check(
      'advisor-facts-grounded',
      facts.wilaya === hallA.wilaya &&
        facts.commune === hallA.commune &&
        facts.capacityMin === hallA.capacityMin &&
        facts.capacityMax === hallA.capacityMax &&
        facts.priceDzd === hallA.priceDzd &&
        JSON.stringify(facts.styles) === JSON.stringify(hallA.styles) &&
        JSON.stringify(facts.amenities) === JSON.stringify(hallA.amenities) &&
        facts.photoCount === 3,
      JSON.stringify(facts).slice(0, 300)
    );
    check(
      'advisor-facts-vs-recommendations',
      facts && typeof facts === 'object' && Array.isArray(facts.amenities) &&
        ok.json.report && typeof ok.json.report === 'object' &&
        SECTIONS.every((k) => Array.isArray(ok.json.report[k])) &&
        !('strengths' in facts) && !('nextActions' in facts),
      'facts hold stored values; report holds recommendation arrays'
    );

    const modeOk = ok.json.mode === 'cached' || ok.json.mode === 'live';
    const modelOk = (ok.json.mode === 'cached' && ok.json.model === 'walimapp-venue-advisor-1') ||
      (ok.json.mode === 'live' && /muse-spark/.test(String(ok.json.model)));
    check('advisor-mode-valid', modeOk && modelOk, `mode=${ok.json.mode} model=${ok.json.model}`);
    check('advisor-demo-without-key', ok.json.mode === 'cached' && typeof ok.json.note === 'string' && ok.json.note.length > 0, JSON.stringify({ mode: ok.json.mode, note: ok.json.note }));
    check(
      'advisor-no-booking-guarantee',
      JSON.stringify(ok.json.report).toLowerCase().includes('garant') === false,
      'cached report must not promise guaranteed bookings'
    );

    const def = await post(advisorPath, {}, jarA);
    check('advisor-default-photos-200', def.status === 200 && validReport(def.json.report), `status=${def.status}`);

    const ar = await post(advisorPath, { lang: 'ar' }, jarA);
    check('advisor-lang-ar', ar.status === 200 && validReport(ar.json.report), `status=${ar.status}`);
    const en = await post(advisorPath, { lang: 'en' }, jarA);
    check('advisor-lang-en', en.status === 200 && validReport(en.json.report), `status=${en.status}`);
    check(
      'advisor-lang-differs',
      JSON.stringify(ar.json.report) !== JSON.stringify(en.json.report) &&
        JSON.stringify(en.json.report) !== JSON.stringify(ok.json.report),
      'reports differ per language'
    );
  } catch (err) {
    failures += 1;
    console.log(`FAIL exception — ${err && err.message}`);
  } finally {
    kill();
    restore();
    const checks = SNAP_FILES.map((f, i) => {
      const after = fs.existsSync(f) ? fs.readFileSync(f) : null;
      const before = snapshots[i];
      return (before == null && after == null) || (before != null && after != null && Buffer.compare(after, before) === 0);
    });
    check('test-data-restored', checks.every(Boolean));
  }
  console.log(failures ? `${failures} FAILURES` : 'ALL ADVISOR TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
