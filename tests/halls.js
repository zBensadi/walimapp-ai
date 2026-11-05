// WalimApp AI — owner halls CRUD + photo uploads test (no dependencies).
// Covers listing own halls, create, update, ownership isolation (403),
// photo upload (valid + invalid mime + too large), photo delete, and hall
// deletion. Snapshots and restores data/*.json (exact raw bytes) and removes
// any files created in public/uploads/ so no test data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3104;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(__dirname, '..', 'data');
const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json', 'halls.json'].map((f) => path.join(DATA, f));
const OWNER_EMAIL = 'owner@test.dz';
const OWNER_PASSWORD = 'OwnerPassword123!';
const OWNER_B_EMAIL = 'ownerb@test.dz';
const OWNER_B_PASSWORD = 'OwnerBPassword123!';
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

async function put(p, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, { method: 'PUT', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j };
}

async function del(p, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, {
    method: 'DELETE',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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

function listUploads() {
  try {
    if (!fs.existsSync(UPLOADS)) return [];
    return fs.readdirSync(UPLOADS).filter((f) => {
      try {
        return fs.statSync(path.join(UPLOADS, f)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

(async () => {
  const snapshots = SNAP_FILES.map((f) => (fs.existsSync(f) ? fs.readFileSync(f) : null));
  const uploadsBefore = new Set(listUploads());
  const restore = () => {
    try {
      SNAP_FILES.forEach((f, i) => {
        if (snapshots[i] == null) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } else {
          fs.writeFileSync(f, snapshots[i]);
        }
      });
      for (const f of listUploads()) {
        if (!uploadsBefore.has(f)) {
          try {
            fs.unlinkSync(path.join(UPLOADS, f));
          } catch { /* best effort */ }
        }
      }
      try {
        if (fs.existsSync(UPLOADS) && fs.readdirSync(UPLOADS).length === 0 && uploadsBefore.size === 0) {
          fs.rmdirSync(UPLOADS);
        }
      } catch { /* best effort */ }
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

    const anonList = await get('/api/owner/halls');
    check('owner-halls-anon-401', anonList.status === 401, JSON.stringify(anonList.json));

    const ownerLogin = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const jarA = ownerLogin.raw ? sessionCookieFrom(ownerLogin.raw) : '';
    const ownerAId = ownerLogin.json.user && ownerLogin.json.user.id;
    check('owner-a-login', ownerLogin.status === 200 && !!jarA && !!ownerAId, JSON.stringify(ownerLogin.json));

    const list0 = await get('/api/owner/halls', jarA);
    check(
      'owner-list-seeded',
      list0.status === 200 && Array.isArray(list0.json.halls) && list0.json.halls.length >= 14,
      `count=${list0.json.halls ? list0.json.halls.length : '?'}`
    );
    check(
      'owner-list-owned',
      Array.isArray(list0.json.halls) && list0.json.halls.every((h) => h.ownerId === ownerAId),
      'all seeded halls claimed by owner A'
    );
    const count0 = list0.json.halls.length;

    const badCreate = await post('/api/owner/halls', { wilaya: '16' }, jarA);
    check('create-missing-fields-400', badCreate.status === 400, JSON.stringify(badCreate.json));

    const newHall = {
      name: 'Test Venue Task04',
      wilaya: '16',
      commune: 'TestCommune',
      capacityMin: 100,
      capacityMax: 400,
      priceDzd: 300000,
      styles: ['moderne'],
      amenities: ['parking', 'clim'],
      desc: 'A test venue for automated checks.',
      phone: '+213550009999',
    };
    const created = await post('/api/owner/halls', newHall, jarA);
    const hallId = created.json.hall && created.json.hall.id;
    check(
      'owner-create-201',
      created.status === 201 && created.json.ok === true && !!hallId &&
        created.json.hall.ownerId === ownerAId &&
        created.json.hall.commune === 'TestCommune',
      JSON.stringify(created.json).slice(0, 300)
    );

    const list1 = await get('/api/owner/halls', jarA);
    const ids1 = new Set((list1.json.halls || []).map((h) => h.id));
    check('owner-list-includes-new', list1.status === 200 && ids1.has(hallId) && list1.json.halls.length === count0 + 1);

    const pubDetail = await get(`/api/halls/${encodeURIComponent(hallId)}`);
    check('public-detail-new-hall', pubDetail.status === 200 && pubDetail.json.hall && pubDetail.json.hall.id === hallId);

    const updated = await put(`/api/owner/halls/${encodeURIComponent(hallId)}`, {
      priceDzd: 350000,
      capacityMax: 450,
      amenities: ['parking', 'clim', 'sono'],
      desc: 'Updated description.',
    }, jarA);
    check(
      'owner-update-200',
      updated.status === 200 && updated.json.ok === true &&
        updated.json.hall.priceDzd === 350000 &&
        updated.json.hall.capacityMax === 450 &&
        updated.json.hall.amenities.includes('sono'),
      JSON.stringify(updated.json).slice(0, 300)
    );

    // Ownership isolation: create owner B by promoting a registered customer.
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
    check(
      'owner-b-login',
      loginB.status === 200 && loginB.json.user && loginB.json.user.role === 'owner' && !!jarB,
      JSON.stringify(loginB.json).slice(0, 200)
    );

    const crossUpdate = await put(`/api/owner/halls/${encodeURIComponent(hallId)}`, { priceDzd: 1 }, jarB);
    check('isolation-update-403', crossUpdate.status === 403, JSON.stringify(crossUpdate.json));

    const crossDelete = await del(`/api/owner/halls/${encodeURIComponent(hallId)}`, undefined, jarB);
    check('isolation-delete-403', crossDelete.status === 403, JSON.stringify(crossDelete.json));

    const listB = await get('/api/owner/halls', jarB);
    const idsB = new Set((listB.json.halls || []).map((h) => h.id));
    check('isolation-list-excludes-a', listB.status === 200 && !idsB.has(hallId), `bCount=${listB.json.halls ? listB.json.halls.length : '?'}`);

    // Photo uploads.
    const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const upOk = await post(`/api/owner/halls/${encodeURIComponent(hallId)}/photos`, {
      imageBase64: tinyPngB64,
      mimeType: 'image/png',
    }, jarA);
    const photoUrl = upOk.json.photos && upOk.json.photos[upOk.json.photos.length - 1];
    check(
      'photo-upload-200',
      upOk.status === 200 && upOk.json.ok === true && typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/') && photoUrl.endsWith('.png'),
      JSON.stringify(upOk.json).slice(0, 200)
    );
    if (photoUrl && photoUrl.startsWith('/uploads/')) {
      const base = path.basename(photoUrl);
      check('photo-file-exists', fs.existsSync(path.join(UPLOADS, base)), base);
      check('photo-filename-safe', /^[0-9a-f-]+\.png$/i.test(base), base);
    }

    const upBadMime = await post(`/api/owner/halls/${encodeURIComponent(hallId)}/photos`, {
      imageBase64: tinyPngB64,
      mimeType: 'image/gif',
    }, jarA);
    check('photo-reject-bad-mime-400', upBadMime.status === 400, JSON.stringify(upBadMime.json));

    const upCross = await post(`/api/owner/halls/${encodeURIComponent(hallId)}/photos`, {
      imageBase64: tinyPngB64,
      mimeType: 'image/png',
    }, jarB);
    check('photo-cross-owner-403', upCross.status === 403, JSON.stringify(upCross.json));

    const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 1, 7);
    const bigB64 = bigBuf.toString('base64');
    const upTooLarge = await post(`/api/owner/halls/${encodeURIComponent(hallId)}/photos`, {
      imageBase64: bigB64,
      mimeType: 'image/jpeg',
    }, jarA);
    check('photo-reject-too-large-400', upTooLarge.status === 400, `status=${upTooLarge.status}`);

    if (photoUrl) {
      const delPhoto = await del(`/api/owner/halls/${encodeURIComponent(hallId)}/photos`, { photoUrl }, jarA);
      check(
        'photo-delete-200',
        delPhoto.status === 200 && delPhoto.json.ok === true && !(delPhoto.json.photos || []).includes(photoUrl),
        JSON.stringify(delPhoto.json).slice(0, 200)
      );
      const base = path.basename(photoUrl);
      check('photo-file-removed', !fs.existsSync(path.join(UPLOADS, base)), base);
    }

    const delHall = await del(`/api/owner/halls/${encodeURIComponent(hallId)}`, undefined, jarA);
    check('owner-delete-200', delHall.status === 200 && delHall.json.ok === true, JSON.stringify(delHall.json));

    const list2 = await get('/api/owner/halls', jarA);
    const ids2 = new Set((list2.json.halls || []).map((h) => h.id));
    check('owner-list-after-delete', list2.status === 200 && !ids2.has(hallId) && list2.json.halls.length === count0);

    const pubGone = await get(`/api/halls/${encodeURIComponent(hallId)}`);
    check('public-detail-after-delete-404', pubGone.status === 404);

    const delAgain = await del(`/api/owner/halls/${encodeURIComponent(hallId)}`, undefined, jarA);
    check('delete-missing-404', delAgain.status === 404);
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
    const leftovers = listUploads().filter((f) => !uploadsBefore.has(f));
    check('uploads-cleaned', leftovers.length === 0, JSON.stringify(leftovers));
  }
  console.log(failures ? `${failures} FAILURES` : 'ALL HALLS TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
