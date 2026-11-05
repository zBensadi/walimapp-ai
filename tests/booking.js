// WalimApp AI — booking workflow test (no dependencies).
// Covers the 7-step client-to-owner flow plus invalid refs, duplicate
// decisions, filtering and restart persistence. Snapshots and restores
// data/inquiries.json (exact raw bytes) so no test data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const INQ_FILE = path.join(__dirname, '..', 'data', 'inquiries.json');
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json'].map((f) => path.join(__dirname, '..', 'data', f));
const OWNER_EMAIL = 'owner@test.dz';
const OWNER_PASSWORD = 'OwnerPassword123!';
let failures = 0;
let server = null;

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
  return { status: r.status, json: j, cacheControl: r.headers.get('cache-control') };
}

async function post(p, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, cacheControl: r.headers.get('cache-control'), raw: r };
}

function startServer() {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
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
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server || server.exitCode != null) return resolve();
    server.once('exit', () => resolve());
    server.kill();
    setTimeout(resolve, 3000).unref();
  });
}

function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      if (server && server.exitCode != null) return reject(new Error('server exited early'));
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
  process.on('exit', () => {
    if (server && server.exitCode == null) server.kill();
  });
  setTimeout(() => {
    console.log('TIMEOUT — forcing exit');
    restore();
    process.exit(2);
  }, 120000).unref();

  try {
    startServer();
    await waitForHealth();

    // Owner session for the protected inbox/decision endpoints.
    const ownerLogin = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const ownerCookie = ownerLogin.raw ? sessionCookieFrom(ownerLogin.raw) : '';
    check('owner-login', ownerLogin.status === 200 && !!ownerCookie, JSON.stringify(ownerLogin.json));
    const ownerUnauth = await get('/api/owner/inquiries');
    check('owner-inbox-anon-401', ownerUnauth.status === 401 && ownerUnauth.json.error === 'unauthorized');

    // 1. Client searches.
    const s = await get('/api/halls/search?wilaya=16&guests=250&budget=700000');
    check('1-search', s.status === 200 && s.json.count >= 1);
    check('cache-no-store-search', s.cacheControl === 'no-store', `cache-control=${s.cacheControl}`);
    const hallA = s.json.halls[0].id;

    // 2-3. Client submits; unique pending reference stored.
    const inq = await post('/api/inquiries', {
      hallId: hallA, name: 'Booking Test', phone: '+213661000001',
      date: '2027-06-12', guests: 250, message: 'workflow-test', consent: true, lang: 'fr',
    });
    const refA = inq.json.reference;
    check('2-3-submit-pending-ref', inq.status === 201 && inq.json.status === 'pending' && /^WAL-[A-Z0-9]{6}$/.test(refA || ''));

    // Second inquiry on another hall/date for filter + reject coverage.
    const inqB = await post('/api/inquiries', {
      hallId: 'h-oran-emir', name: 'Second Test', phone: '+213662000002',
      date: '2027-07-04', guests: 150, message: '', consent: true, lang: 'en',
    });
    const refB = inqB.json.reference;
    check('second-submit', inqB.status === 201 && /^WAL-[A-Z0-9]{6}$/.test(refB || '') && refB !== refA);

    // Competing inquiry on the SAME hall + date: multiple pending allowed.
    const inqC = await post('/api/inquiries', {
      hallId: hallA, name: 'Competing Test', phone: '+213663000003',
      date: '2027-06-12', guests: 200, message: 'competing', consent: true, lang: 'fr',
    });
    const refC = inqC.json.reference;
    check('competing-pending-allowed', inqC.status === 201 && inqC.json.status === 'pending' && /^WAL-[A-Z0-9]{6}$/.test(refC || '') && refC !== refA);

    // Client checks status while pending: fresh (no-store), never cached.
    const lookPending = await get(`/api/inquiries/${refA}`);
    check('lookup-pending-fresh', lookPending.status === 200 && lookPending.json.inquiry.status === 'pending');
    check('cache-no-store-inquiry-track', lookPending.cacheControl === 'no-store', `cache-control=${lookPending.cacheControl}`);

    // While only pending, the hall stays available in date-aware search.
    const availPending = await get('/api/halls/search?wilaya=16&date=2027-06-12');
    check(
      'search-includes-hall-while-pending',
      availPending.status === 200 && (availPending.json.halls || []).some((h) => h.id === hallA),
      `count=${availPending.json.count}`
    );

    // 4. Owner sees the requests.
    const owner = await get('/api/owner/inquiries', ownerCookie);
    const refs = new Set((owner.json.inquiries || []).map((i) => i.reference));
    check('4-owner-sees-requests', owner.status === 200 && refs.has(refA) && refs.has(refB) && refs.has(refC));
    check('owner-counts', owner.json.counts && owner.json.counts.pending >= 3);
    check('cache-no-store-owner-inbox', owner.cacheControl === 'no-store', `cache-control=${owner.cacheControl}`);

    // Filters.
    const fStatus = await get('/api/owner/inquiries?status=pending', ownerCookie);
    check('filter-status', fStatus.json.inquiries.every((i) => i.status === 'pending') && fStatus.json.inquiries.length >= 3);
    const fHall = await get(`/api/owner/inquiries?hallId=${hallA}`, ownerCookie);
    check('filter-hall', fHall.json.inquiries.length >= 2 && fHall.json.inquiries.every((i) => i.hallId === hallA));
    const fDate = await get('/api/owner/inquiries?date=2027-07-04', ownerCookie);
    check('filter-date', fDate.json.inquiries.length >= 1 && fDate.json.inquiries.every((i) => i.date === '2027-07-04'));
    const fBad = await get('/api/owner/inquiries?status=bogus', ownerCookie);
    check('filter-invalid-status-400', fBad.status === 400);

    // 5-6. Owner accepts A with a note; persisted to file.
    const decA = await post(`/api/owner/inquiries/${refA}/decision`, { decision: 'accept', note: 'Salle disponible, acompte 30%.' }, ownerCookie);
    check('5-accept', decA.status === 200 && decA.json.status === 'confirmed');
    const fileRows = JSON.parse(fs.readFileSync(INQ_FILE, 'utf8'));
    const rowA = fileRows.find((i) => i.reference === refA);
    check('6-persisted', rowA && rowA.status === 'confirmed' && rowA.ownerNote.includes('acompte') && !!rowA.decidedAt);

    // Client immediately sees confirmed (never stale pending).
    const lookFresh = await get(`/api/inquiries/${refA}`);
    check('fresh-status-after-accept', lookFresh.status === 200 && lookFresh.json.inquiry.status === 'confirmed');
    check('cache-no-store-after-accept', lookFresh.cacheControl === 'no-store', `cache-control=${lookFresh.cacheControl}`);

    // Double-booking prevention: accepting the competing inquiry conflicts.
    const decConflict = await post(`/api/owner/inquiries/${refC}/decision`, { decision: 'accept', note: 'Second accept attempt.' }, ownerCookie);
    check(
      'double-book-409',
      decConflict.status === 409 && decConflict.json.error === 'date_already_booked' &&
        decConflict.json.hallId === hallA && decConflict.json.date === '2027-06-12' &&
        decConflict.json.conflictingReference === refA,
      JSON.stringify(decConflict.json)
    );
    const lookC = await get(`/api/inquiries/${refC}`);
    check('conflict-stays-pending', lookC.status === 200 && lookC.json.inquiry.status === 'pending');

    // Rejecting on an already-booked date still succeeds.
    const decRejectC = await post(`/api/owner/inquiries/${refC}/decision`, { decision: 'reject', note: 'Date déjà réservée.' }, ownerCookie);
    check('reject-on-booked-date', decRejectC.status === 200 && decRejectC.json.status === 'rejected');

    // Date-aware search: hallA excluded on its booked date, available otherwise.
    const bookedDay = await get('/api/halls/search?wilaya=16&date=2027-06-12');
    check(
      'search-excludes-hall-on-booked-date',
      bookedDay.status === 200 && !(bookedDay.json.halls || []).some((h) => h.id === hallA),
      `count=${bookedDay.json.count}`
    );
    const otherDay = await get('/api/halls/search?wilaya=16&date=2027-06-13');
    check(
      'search-includes-hall-on-other-date',
      otherDay.status === 200 && (otherDay.json.halls || []).some((h) => h.id === hallA),
      `count=${otherDay.json.count}`
    );

    // Stage 2: AI rank/discovery also respects confirmed-booking availability.
    const aiBooked = await post('/api/ai/rank', { criteria: { wilaya: '16', date: '2027-06-12' }, lang: 'fr' });
    check(
      'ai-rank-excludes-hall-on-booked-date',
      aiBooked.status === 200 &&
        !(aiBooked.json.ranking || []).some((r) => r.id === hallA) &&
        !(aiBooked.json.halls || []).some((h) => h.id === hallA),
      `hallA=${hallA} ranking=${JSON.stringify((aiBooked.json.ranking || []).map((r) => r.id))}`
    );
    const aiPrompt = await post('/api/ai/rank', { prompt: 'I need a hall in Algiers for 2027-06-12', criteria: { wilaya: '16' }, lang: 'en' });
    check(
      'ai-rank-prompt-excludes-hall-on-booked-date',
      aiPrompt.status === 200 &&
        !(aiPrompt.json.ranking || []).some((r) => r.id === hallA) &&
        !(aiPrompt.json.halls || []).some((h) => h.id === hallA),
      `hallA=${hallA} ranking=${JSON.stringify((aiPrompt.json.ranking || []).map((r) => r.id))}`
    );
    const aiOther = await post('/api/ai/discover', { criteria: { wilaya: '16', date: '2027-06-13' }, lang: 'fr' });
    check(
      'ai-discover-includes-hall-on-other-date',
      aiOther.status === 200 &&
        (aiOther.json.ranking || []).some((r) => r.id === hallA) &&
        (aiOther.json.halls || []).some((h) => h.id === hallA),
      `hallA=${hallA} count=${aiOther.json.count}`
    );

    // Duplicate + invalid decisions.
    const dup = await post(`/api/owner/inquiries/${refA}/decision`, { decision: 'reject' }, ownerCookie);
    check('duplicate-409', dup.status === 409 && dup.json.error === 'already_decided' && dup.json.status === 'confirmed');
    const badDec = await post(`/api/owner/inquiries/${refB}/decision`, { decision: 'maybe' }, ownerCookie);
    check('invalid-decision-400', badDec.status === 400);
    const unknownDec = await post('/api/owner/inquiries/WAL-ZZZZZ0/decision', { decision: 'accept' }, ownerCookie);
    check('decision-unknown-404', unknownDec.status === 404);

    // Reject path for B.
    const decB = await post(`/api/owner/inquiries/${refB}/decision`, { decision: 'reject', note: 'Date complète.' }, ownerCookie);
    check('reject', decB.status === 200 && decB.json.status === 'rejected');

    // 7. Client lookup: updated status, owner note, no personal data.
    const lookA = await get(`/api/inquiries/${refA}`);
    check('7-lookup-confirmed', lookA.status === 200 && lookA.json.inquiry.status === 'confirmed');
    check('lookup-owner-note', lookA.json.inquiry.ownerNote.includes('acompte'));
    check('lookup-no-pii', !('name' in lookA.json.inquiry) && !('phone' in lookA.json.inquiry) && !('consentAt' in lookA.json.inquiry) && !('consent' in lookA.json.inquiry));
    const lookB = await get(`/api/inquiries/${refB}`);
    check('lookup-rejected', lookB.json.inquiry.status === 'rejected');
    const lookBad = await get('/api/inquiries/WAL-ZZZZZ0');
    check('lookup-invalid-404', lookBad.status === 404 && lookBad.json.error === 'inquiry_not_found');

    // Restart persistence.
    await stopServer();
    startServer();
    await waitForHealth();
    const reA = await get(`/api/inquiries/${refA}`);
    const reB = await get(`/api/inquiries/${refB}`);
    const reC = await get(`/api/inquiries/${refC}`);
    check('restart-persisted', reA.json.inquiry.status === 'confirmed' && reB.json.inquiry.status === 'rejected' && reC.json.inquiry.status === 'rejected');
  } catch (err) {
    failures += 1;
    console.log(`FAIL exception — ${err && err.message}`);
  } finally {
    await stopServer();
    restore();
    const restored = SNAP_FILES.map((f, i) => {
      const after = fs.existsSync(f) ? fs.readFileSync(f) : null;
      const before = snapshots[i];
      return (before == null && after == null) || (before != null && after != null && Buffer.compare(after, before) === 0);
    });
    check('test-data-restored', restored.every(Boolean));
  }
  console.log(failures ? `${failures} FAILURES` : 'ALL BOOKING TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
