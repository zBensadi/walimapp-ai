// WalimApp AI — bounded API smoke test (no dependencies).
// Starts the server on 127.0.0.1:3101, exercises every API, stops it.
// Snapshots and restores data/inquiries.json (exact raw bytes) so no test
// data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json'].map((f) => path.join(__dirname, '..', 'data', f));
let failures = 0;

function check(name, cond, extra) {
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function get(p) {
  const r = await fetch(BASE + p);
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, cacheControl: r.headers.get('cache-control') };
}

async function post(p, body) {
  const r = await fetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, cacheControl: r.headers.get('cache-control') };
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
    env: { ...process.env, PORT: String(PORT), MODEL_API_KEY: '', META_API_KEY: '' },
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
  }, 90000).unref();

  try {
    await waitForHealth(server);
    check('health', true);

    const w = await get('/api/wilayas');
    check('wilayas=69', w.status === 200 && w.json.wilayas && w.json.wilayas.length === 69, JSON.stringify(w.json).slice(0, 120));
    check('wilaya-69-messaad', w.json.wilayas && w.json.wilayas[68] && w.json.wilayas[68].code === '69');
    check('cache-no-store-wilayas', w.cacheControl === 'no-store', `cache-control=${w.cacheControl}`);

    const s = await get('/api/halls/search?wilaya=16&guests=300&budget=500000&style=moderne');
    check('search-16', s.status === 200 && s.json.count >= 1, `count=${s.json.count}`);
    check('search-whole-dzd', s.json.halls && s.json.halls.every((h) => Number.isInteger(h.priceDzd)));
    check('cache-no-store-search', s.cacheControl === 'no-store', `cache-control=${s.cacheControl}`);
    const bad = await get('/api/halls/search?wilaya=99');
    check('search-rejects-wilaya-99', bad.status === 400);

    // Stage 3: services & amenities filter.
    const am = await get('/api/halls/search?wilaya=16&amenities=parking,cuisine');
    const amIds = (am.json.halls || []).map((h) => h.id).sort();
    check(
      'search-amenities-algiers',
      am.status === 200 && am.json.count === 3 &&
        JSON.stringify(amIds) === JSON.stringify(['h-alger-jardin', 'h-alger-nour', 'h-alger-royal']),
      `count=${am.json.count} ids=${JSON.stringify(amIds)}`
    );
    const lodge = await get('/api/halls/search?amenities=hebergement');
    const lodgeIds = (lodge.json.halls || []).map((h) => h.id).sort();
    check(
      'search-amenities-lodging',
      lodge.status === 200 && lodge.json.count === 2 &&
        JSON.stringify(lodgeIds) === JSON.stringify(['h-annaba-rim', 'h-oran-mediterranee']),
      `count=${lodge.json.count} ids=${JSON.stringify(lodgeIds)}`
    );
    const amNone = await get('/api/halls/search?amenities=jardin,hebergement');
    check('search-amenities-no-match', amNone.status === 200 && amNone.json.count === 0, `count=${amNone.json.count}`);

    const one = await get('/api/halls/h-alger-royal');
    check('hall-detail', one.status === 200 && one.json.hall && one.json.hall.id === 'h-alger-royal');
    const missing = await get('/api/halls/does-not-exist');
    check('hall-404', missing.status === 404);

    const rank = await post('/api/ai/rank', { criteria: { wilaya: '16', guests: 300 }, lang: 'fr' });
    check('rank-cached', rank.status === 200 && rank.json.mode === 'cached' && Array.isArray(rank.json.ranking) && rank.json.ranking.length >= 1);

    // Stage 2: natural-language discovery parsing + grounded ranking.
    const nlPrompt = 'I need an elegant wedding hall in Algiers for 250 guests, in June, with parking and catering, with a budget of 450,000 DZD.';
    const nl = await post('/api/ai/rank', { prompt: nlPrompt, lang: 'en' });
    const ex = (nl.json && nl.json.extractedCriteria) || {};
    check('nl-wilaya-16', nl.status === 200 && ex.wilaya === '16', JSON.stringify(ex));
    check('nl-guests-250', ex.guests === 250, JSON.stringify(ex));
    check('nl-budget-450000', ex.budget === 450000, JSON.stringify(ex));
    check('nl-month-6', ex.month === 6, JSON.stringify(ex));
    check('nl-amenities', Array.isArray(ex.amenities) && ex.amenities.includes('parking') && ex.amenities.includes('cuisine'), JSON.stringify(ex));
    check('nl-no-restrictive-style', !ex.style, JSON.stringify(ex));
    const nlRankIds = Array.isArray(nl.json.ranking) ? nl.json.ranking.map((r) => r.id) : [];
    const nlHallIds = Array.isArray(nl.json.halls) ? nl.json.halls.map((h) => h.id) : [];
    const nlExpected = ['h-alger-nour', 'h-alger-jardin'];
    check(
      'nl-ranking-grounded',
      nlRankIds.length === 2 && nlExpected.every((id) => nlRankIds.includes(id)) && !nlRankIds.includes('h-alger-royal'),
      JSON.stringify(nlRankIds)
    );
    check(
      'nl-halls-grounded',
      nlHallIds.length === 2 && nlExpected.every((id) => nlHallIds.includes(id)) && !nlHallIds.includes('h-alger-royal'),
      JSON.stringify(nlHallIds)
    );
    check(
      'nl-halls-match-filters',
      Array.isArray(nl.json.halls) && nl.json.halls.every((h) => h.wilaya === '16' && h.priceDzd <= 450000 * 1.25 && h.amenities.includes('parking') && h.amenities.includes('cuisine')),
      JSON.stringify((nl.json.halls || []).map((h) => ({ id: h.id, price: h.priceDzd })))
    );
    check('nl-count', nl.json.count === 2, `count=${nl.json.count}`);
    check('nl-fallback-reason', nl.json.mode === 'cached' && typeof nl.json.fallbackReason === 'string' && nl.json.fallbackReason.length > 0, JSON.stringify(nl.json.fallbackReason));

    // Alias endpoint behaves the same.
    const disc = await post('/api/ai/discover', { prompt: nlPrompt, lang: 'en' });
    check('discover-alias', disc.status === 200 && disc.json.mode === 'cached' && (disc.json.extractedCriteria || {}).wilaya === '16' && Array.isArray(disc.json.halls) && disc.json.halls.length === 2);

    // Anti-hallucination: every ranked ID exists and hall facts match data/halls.json exactly.
    const hallsSeed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'halls.json'), 'utf8')).halls;
    const seedById = new Map(hallsSeed.map((h) => [h.id, h]));
    check(
      'rank-ids-exist',
      nlRankIds.every((id) => seedById.has(id)) && nlHallIds.every((id) => seedById.has(id)),
      JSON.stringify(nlRankIds)
    );
    check(
      'rank-halls-exact',
      Array.isArray(nl.json.halls) && nl.json.halls.every((h) => {
        const s = seedById.get(h.id);
        return s && h.priceDzd === s.priceDzd && h.capacityMin === s.capacityMin && h.capacityMax === s.capacityMax &&
          JSON.stringify(h.amenities) === JSON.stringify(s.amenities);
      }),
      'hall facts must match seed exactly'
    );

    const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const seg = await post('/api/ai/segment', { imageBase64: tinyPngB64 + tinyPngB64 + tinyPngB64, mimeType: 'image/png', lang: 'en' });
    check('segment-cached', seg.status === 200 && seg.json.mode === 'cached' && Array.isArray(seg.json.regions) && seg.json.regions.length >= 3);

    const deco = await post('/api/ai/decorate', { style: 'oriental', palette: 'gold', notes: 'test', lang: 'ar' });
    check('decorate-cached', deco.status === 200 && deco.json.mode === 'cached' && Array.isArray(deco.json.concepts) && deco.json.concepts.length === 2);
    check('decorate-art', deco.json.concepts && deco.json.concepts[0].imageDataUrl.startsWith('data:image/svg+xml;base64,'));

    const noConsent = await post('/api/inquiries', { hallId: 'h-alger-royal', name: 'Test', phone: '+213500000000', date: '2026-12-01', guests: 200, consent: false });
    check('inquiry-requires-consent', noConsent.status === 400 && noConsent.json.error === 'consent_required');

    const inq = await post('/api/inquiries', { hallId: 'h-alger-royal', name: 'Amine Test', phone: '+213500000000', date: '2026-12-01', guests: 200, message: 'smoke', consent: true, lang: 'fr' });
    check('inquiry-pending-ref', inq.status === 201 && inq.json.status === 'pending' && /^WAL-[A-Z0-9]{6}$/.test(inq.json.reference || ''), JSON.stringify(inq.json));
    check('cache-no-store-inquiry-submit', inq.cacheControl === 'no-store', `cache-control=${inq.cacheControl}`);

    const track = await get(`/api/inquiries/${inq.json.reference}`);
    check('cache-no-store-inquiry-track', track.status === 200 && track.cacheControl === 'no-store', `cache-control=${track.cacheControl}`);

    const owner = await get('/api/owner/inquiries');
    check('owner-inbox-anon-401', owner.status === 401 && owner.json.error === 'unauthorized', JSON.stringify(owner.json));
    check('cache-no-store-owner-inbox', owner.cacheControl === 'no-store', `cache-control=${owner.cacheControl}`);

    const ms = await get('/api/meta-status');
    check('meta-status', ms.status === 200 && ms.json.keyConfigured === false && JSON.stringify(ms.json).includes('muse-spark-1.3'));
    check(
      'meta-models-only',
      ms.json.models && ms.json.models.spark === 'muse-spark-1.3' && ms.json.models.sam === 'sam-3.1' && ms.json.models.image === 'muse-image-1.0',
      JSON.stringify(ms.json.models)
    );

    const idx = await fetch(`${BASE}/`);
    check('serves-index', idx.ok && (await idx.text()).includes('WalimApp'));
  } catch (err) {
    failures += 1;
    console.log(`FAIL exception — ${err && err.message}`);
  } finally {
    kill();
    restore();
    const restored = SNAP_FILES.map((f, i) => {
      const after = fs.existsSync(f) ? fs.readFileSync(f) : null;
      const before = snapshots[i];
      return (before == null && after == null) || (before != null && after != null && Buffer.compare(after, before) === 0);
    });
    check('test-data-restored', restored.every(Boolean));
  }
  console.log(failures ? `${failures} FAILURES` : 'ALL SMOKE TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
