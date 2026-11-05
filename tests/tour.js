// WalimApp AI — 360° tour panorama workflow test (no dependencies).
// Covers POST /api/owner/halls/:id/panoramas (equirectangular validation,
// reject non-2:1, accept 2:1, reject bad mime + oversize), PUT .../tour
// (hotspot wiring, firstScene, reject bad targets), DELETE .../panoramas/
// :sceneId (scene + file removal, hotspot purge), cross-owner 403s, anon
// 401s, and missing-hall 404s. Snapshots and restores data/*.json (exact
// raw bytes) and removes any files created in public/uploads/ so no test
// data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3106;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(__dirname, '..', 'data');
const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const PANO_DIR = path.join(UPLOADS, 'panoramas');
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json', 'halls.json'].map((f) => path.join(DATA, f));
const OWNER_EMAIL = 'owner@test.dz';
const OWNER_PASSWORD = 'OwnerPassword123!';
const OWNER_B_EMAIL = 'ownerb@test.dz';
const OWNER_B_PASSWORD = 'OwnerBPassword123!';
const CUSTOMER_EMAIL = 'tour-customer@test.dz';
const CUSTOMER_PASSWORD = 'CustomerPassword123!';
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

// Minimal valid JPEG with a SOF0 segment declaring width x height.
function jpegB64(width, height) {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08]);
  const dims = Buffer.alloc(4);
  dims.writeUInt16BE(height, 0);
  dims.writeUInt16BE(width, 2);
  const tail = Buffer.from([0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]);
  return Buffer.concat([head, dims, tail]).toString('base64');
}

// Minimal valid PNG (signature + IHDR) declaring width x height.
function pngB64(width, height) {
  const buf = Buffer.alloc(26);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString('base64');
}

function listUploadsRecursive(dir) {
  const out = [];
  try {
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      try {
        const st = fs.statSync(full);
        if (st.isFile()) out.push(full);
        else if (st.isDirectory()) out.push(...listUploadsRecursive(full));
      } catch { /* best effort */ }
    }
  } catch { /* best effort */ }
  return out;
}

(async () => {
  const snapshots = SNAP_FILES.map((f) => (fs.existsSync(f) ? fs.readFileSync(f) : null));
  const uploadsBefore = new Set(listUploadsRecursive(UPLOADS));
  const beforePanoDirExisted = fs.existsSync(PANO_DIR);
  const restore = () => {
    try {
      SNAP_FILES.forEach((f, i) => {
        if (snapshots[i] == null) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        } else {
          fs.writeFileSync(f, snapshots[i]);
        }
      });
      for (const full of listUploadsRecursive(UPLOADS)) {
        if (!uploadsBefore.has(full)) {
          try {
            fs.unlinkSync(full);
          } catch { /* best effort */ }
        }
      }
      try {
        if (!beforePanoDirExisted && fs.existsSync(PANO_DIR) && fs.readdirSync(PANO_DIR).length === 0) {
          fs.rmdirSync(PANO_DIR);
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

    const ownerLogin = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const jarA = ownerLogin.raw ? sessionCookieFrom(ownerLogin.raw) : '';
    check('owner-a-login', ownerLogin.status === 200 && !!jarA, JSON.stringify(ownerLogin.json).slice(0, 200));

    const created = await post('/api/owner/halls', {
      name: 'Test Venue Tour360',
      wilaya: '16',
      commune: 'TourTest',
      capacityMin: 100,
      capacityMax: 400,
      priceDzd: 300000,
      styles: ['moderne'],
      amenities: ['parking'],
      desc: 'A test venue for 360 tour checks.',
    }, jarA);
    const hallId = created.json.hall && created.json.hall.id;
    check('owner-create-venue-201', created.status === 201 && !!hallId, JSON.stringify(created.json).slice(0, 200));
    if (!hallId) throw new Error('setup failed: no hall');
    const panoPath = `/api/owner/halls/${encodeURIComponent(hallId)}/panoramas`;
    const tourPath = `/api/owner/halls/${encodeURIComponent(hallId)}/tour`;

    // Unauthenticated + wrong-role access.
    const anonPost = await post(panoPath, { imageBase64: 'x', mimeType: 'image/jpeg' });
    check('pano-anon-401', anonPost.status === 401 && anonPost.json.error === 'unauthorized', JSON.stringify(anonPost.json));
    const anonPut = await put(tourPath, { tourScenes: [] });
    check('tour-anon-401', anonPut.status === 401 && anonPut.json.error === 'unauthorized', JSON.stringify(anonPut.json));
    const anonDel = await del(`${panoPath}/scene-x`);
    check('pano-del-anon-401', anonDel.status === 401 && anonDel.json.error === 'unauthorized', JSON.stringify(anonDel.json));

    const regC = await post('/api/auth/register', {
      fullName: 'Tour Customer', email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD, confirmPassword: CUSTOMER_PASSWORD,
    });
    check('customer-register', regC.status === 201, JSON.stringify(regC.json).slice(0, 200));
    const jarC = regC.raw ? sessionCookieFrom(regC.raw) : '';
    const custPost = await post(panoPath, { imageBase64: 'x', mimeType: 'image/jpeg' }, jarC);
    check('pano-customer-403', custPost.status === 403 && custPost.json.error === 'forbidden', JSON.stringify(custPost.json));

    // Second owner for cross-owner checks.
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

    // Validation: square image is not equirectangular.
    const square = await post(panoPath, {
      imageBase64: jpegB64(100, 100),
      mimeType: 'image/jpeg',
      title: 'Square',
    }, jarA);
    check(
      'pano-reject-square-400',
      square.status === 400 && square.json.error === 'not_equirectangular',
      JSON.stringify(square.json).slice(0, 200)
    );

    // Validation: tall portrait PNG rejected too.
    const portrait = await post(panoPath, {
      imageBase64: pngB64(100, 300),
      mimeType: 'image/png',
      title: 'Portrait',
    }, jarA);
    check(
      'pano-reject-portrait-400',
      portrait.status === 400 && portrait.json.error === 'not_equirectangular',
      JSON.stringify(portrait.json).slice(0, 200)
    );

    // Validation: bad mime + garbage pixels.
    const badMime = await post(panoPath, {
      imageBase64: jpegB64(200, 100),
      mimeType: 'image/gif',
      title: 'Gif',
    }, jarA);
    check('pano-reject-bad-mime-400', badMime.status === 400 && badMime.json.error === 'unsupported_image_type', JSON.stringify(badMime.json));
    const garbage = await post(panoPath, {
      imageBase64: Buffer.from('not-an-image-at-all-pixels').toString('base64'),
      mimeType: 'image/jpeg',
      title: 'Garbage',
    }, jarA);
    check('pano-reject-garbage-400', garbage.status === 400 && garbage.json.error === 'invalid_image', JSON.stringify(garbage.json));

    // Validation: oversize (>10MB).
    const bigB64 = Buffer.alloc(10 * 1024 * 1024 + 1, 7).toString('base64');
    const tooLarge = await post(panoPath, {
      imageBase64: bigB64,
      mimeType: 'image/jpeg',
      title: 'Huge',
    }, jarA);
    check('pano-reject-too-large-400', tooLarge.status === 400 && tooLarge.json.error === 'image_too_large', `status=${tooLarge.status}`);

    // Accept a genuine 2:1 equirectangular JPEG.
    const up1 = await post(panoPath, {
      imageBase64: jpegB64(200, 100),
      mimeType: 'image/jpeg',
      title: 'Entrée',
    }, jarA);
    const scene1 = (up1.json.tourScenes || []).find((s) => s && s.title === 'Entrée');
    check(
      'pano-upload-2to1-200',
      up1.status === 200 && up1.json.ok === true && !!scene1 &&
        typeof scene1.id === 'string' && scene1.id.startsWith('scene-') &&
        typeof scene1.panorama === 'string' && scene1.panorama.startsWith('/uploads/panoramas/') &&
        Array.isArray(scene1.hotSpots),
      JSON.stringify(up1.json).slice(0, 300)
    );
    if (scene1 && scene1.panorama) {
      const base = path.basename(scene1.panorama);
      check('pano-file-exists', fs.existsSync(path.join(PANO_DIR, base)), base);
      check('pano-filename-safe', /^[0-9a-f-]+\.jpg$/i.test(base), base);
    }

    // Second scene, then wire them together.
    const up2 = await post(panoPath, {
      imageBase64: pngB64(400, 200),
      mimeType: 'image/png',
      title: 'Grande Salle',
    }, jarA);
    const scenes2 = up2.json.tourScenes || [];
    const scene2 = scenes2.find((s) => s && s.title === 'Grande Salle');
    check('pano-upload-second-200', up2.status === 200 && !!scene2, JSON.stringify(up2.json).slice(0, 200));

    const wired = await put(tourPath, {
      tourScenes: [
        { ...scene1, hotSpots: [{ pitch: -2.1, yaw: 132.9, text: 'Grande Salle', targetSceneId: scene2.id }] },
        { ...scene2, hotSpots: [{ pitch: -0.6, yaw: 37.1, text: 'Entrée', targetSceneId: scene1.id }] },
      ],
      firstScene: scene2.id,
    }, jarA);
    check(
      'tour-wire-200',
      wired.status === 200 && wired.json.ok === true && wired.json.firstScene === scene2.id &&
        (wired.json.tourScenes || []).length >= 2,
      JSON.stringify(wired.json).slice(0, 300)
    );

    // Public detail reflects the published tour.
    const pub = await get(`/api/halls/${encodeURIComponent(hallId)}`);
    const pubScenes = (pub.json.hall && pub.json.hall.tourScenes) || [];
    check(
      'tour-public-visible',
      pub.status === 200 && pub.json.hall.firstTourScene === scene2.id &&
        pubScenes.length >= 2 &&
        pubScenes.some((s) => s.id === scene1.id && (s.hotSpots || [])[0] && s.hotSpots[0].targetSceneId === scene2.id),
      JSON.stringify(pub.json.hall && { firstTourScene: pub.json.hall.firstTourScene, n: pubScenes.length })
    );

    // Reject hotspot to an unknown scene, and unknown scene ids.
    const badTarget = await put(tourPath, {
      tourScenes: [{ ...scene1, hotSpots: [{ pitch: 0, yaw: 0, text: 'Nowhere', targetSceneId: 'scene-nope' }] }],
      firstScene: scene1.id,
    }, jarA);
    check('tour-reject-bad-target-400', badTarget.status === 400 && badTarget.json.error === 'invalid_hotspots', JSON.stringify(badTarget.json));
    const badScene = await put(tourPath, {
      tourScenes: [{ id: 'scene-nope', title: 'X', panorama: '/uploads/panoramas/x.jpg', hotSpots: [] }],
      firstScene: 'scene-nope',
    }, jarA);
    check('tour-reject-unknown-scene-400', badScene.status === 400 && badScene.json.error === 'invalid_tourScenes', JSON.stringify(badScene.json));
    const badFirst = await put(tourPath, {
      tourScenes: [{ ...scene1, hotSpots: [] }],
      firstScene: 'scene-nope',
    }, jarA);
    check('tour-reject-bad-first-400', badFirst.status === 400 && badFirst.json.error === 'invalid_firstScene', JSON.stringify(badFirst.json));

    // Cross-owner protection on all three endpoints.
    const crossPost = await post(panoPath, {
      imageBase64: jpegB64(200, 100),
      mimeType: 'image/jpeg',
      title: 'Intruder',
    }, jarB);
    check('tour-cross-post-403', crossPost.status === 403 && crossPost.json.error === 'forbidden', JSON.stringify(crossPost.json));
    const crossPut = await put(tourPath, { tourScenes: [], firstScene: null }, jarB);
    check('tour-cross-put-403', crossPut.status === 403 && crossPut.json.error === 'forbidden', JSON.stringify(crossPut.json));
    const crossDel = await del(`${panoPath}/${encodeURIComponent(scene1.id)}`, undefined, jarB);
    check('tour-cross-del-403', crossDel.status === 403 && crossDel.json.error === 'forbidden', JSON.stringify(crossDel.json));

    // Missing hall + missing scene.
    const missPost = await post('/api/owner/halls/does-not-exist/panoramas', {
      imageBase64: jpegB64(200, 100),
      mimeType: 'image/jpeg',
    }, jarA);
    check('pano-missing-hall-404', missPost.status === 404 && missPost.json.error === 'hall_not_found', JSON.stringify(missPost.json));
    const missPut = await put('/api/owner/halls/does-not-exist/tour', { tourScenes: [] }, jarA);
    check('tour-missing-hall-404', missPut.status === 404 && missPut.json.error === 'hall_not_found', JSON.stringify(missPut.json));
    const missDel = await del(`${panoPath}/scene-does-not-exist`, undefined, jarA);
    check('pano-missing-scene-404', missDel.status === 404 && missDel.json.error === 'scene_not_found', JSON.stringify(missDel.json));

    // Delete the second scene: file unlinked, scene removed, hotspot purged.
    const pano2base = scene2 && scene2.panorama ? path.basename(scene2.panorama) : '';
    const delScene = await del(`${panoPath}/${encodeURIComponent(scene2.id)}`, undefined, jarA);
    const remaining = delScene.json.tourScenes || [];
    check(
      'pano-delete-200',
      delScene.status === 200 && delScene.json.ok === true &&
        remaining.every((s) => s.id !== scene2.id) &&
        remaining.every((s) => !(s.hotSpots || []).some((hp) => (hp.targetSceneId || hp.sceneId) === scene2.id)),
      JSON.stringify(delScene.json).slice(0, 300)
    );
    if (pano2base) {
      check('pano-file-unlinked', !fs.existsSync(path.join(PANO_DIR, pano2base)), pano2base);
    }

    // Public detail no longer references the deleted scene.
    const pub2 = await get(`/api/halls/${encodeURIComponent(hallId)}`);
    const pubScenes2 = (pub2.json.hall && pub2.json.hall.tourScenes) || [];
    check(
      'tour-public-after-delete',
      pub2.status === 200 && pubScenes2.every((s) => s.id !== scene2.id),
      `n=${pubScenes2.length}`
    );

    // Clean up the first scene too so the hall is left as found.
    const delScene1 = await del(`${panoPath}/${encodeURIComponent(scene1.id)}`, undefined, jarA);
    check('pano-delete-first-200', delScene1.status === 200, JSON.stringify(delScene1.json).slice(0, 200));
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
    const leftovers = listUploadsRecursive(UPLOADS).filter((f) => !uploadsBefore.has(f));
    check('test-uploads-cleaned', leftovers.length === 0, leftovers.slice(0, 3).join(', '));
  }
  console.log(failures ? `${failures} FAILURES` : 'ALL TOUR TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
