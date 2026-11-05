// WalimApp AI — multi-owner architecture + super admin test (no dependencies).
// Covers public owner registration (forced pending status), pending-owner
// enforcement (403 owner_pending_approval), super admin provisioning,
// approve/suspend/reject flows, cross-owner hall + inquiry isolation (403),
// public discovery filtering for non-approved owners, and /api/admin/*
// guards (401 anon, 403 non-admin). Snapshots and restores
// data/users.json, data/sessions.json, data/inquiries.json and
// data/halls.json (exact raw bytes) so no test data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(__dirname, '..', 'data');
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json', 'halls.json'].map((f) => path.join(DATA, f));
const OWNER_EMAIL = 'owner@test.dz';
const OWNER_PASSWORD = 'OwnerPassword123!';
const ADMIN_EMAIL = 'admin@test.dz';
const ADMIN_PASSWORD = 'AdminPassword123!';
const OWNER_A = {
  fullName: 'Owner Alpha',
  email: 'owner-alpha@test.dz',
  password: 'AlphaOwner123!',
  phone: '+213661000100',
  businessName: 'Palais Alpha',
  wilaya: '16',
  commune: 'Hydra',
  businessDescription: 'Grand palais de mariage a Alger, 400 places.',
};
const OWNER_B = {
  fullName: 'Owner Beta',
  email: 'owner-beta@test.dz',
  password: 'BetaOwner123!',
  phone: '+213662000200',
  businessName: 'Salle Beta',
  wilaya: '31',
  commune: 'Bir El Djir',
  businessDescription: 'Salle moderne vue mer a Oran, 300 places.',
};
const CUSTOMER = { fullName: 'Multi Customer', email: 'multi-customer@test.dz', password: 'Customer789!' };
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

const HALL_A = {
  name: 'Task08 Venue Alpha',
  wilaya: '16',
  commune: 'HydraTest',
  capacityMin: 100,
  capacityMax: 400,
  priceDzd: 300000,
  styles: ['moderne'],
  amenities: ['parking'],
  desc: 'Multi-owner test venue.',
  phone: '+213550001111',
};

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
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
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

    // Seed demo owner stays backwards compatible (approved).
    const seedLogin = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    check(
      'seed-owner-approved',
      seedLogin.status === 200 && seedLogin.json.user && seedLogin.json.user.role === 'owner' &&
        seedLogin.json.user.status === 'approved',
      JSON.stringify(seedLogin.json).slice(0, 200)
    );

    // A customer exists for isolation + admin-guard checks. Role override ignored.
    const regC = await post('/api/auth/register', {
      fullName: CUSTOMER.fullName,
      email: CUSTOMER.email,
      password: CUSTOMER.password,
      confirmPassword: CUSTOMER.password,
      role: 'super_admin',
      status: 'pending',
    });
    const jarC = regC.raw ? sessionCookieFrom(regC.raw) : '';
    const customerId = regC.json.user && regC.json.user.id;
    check(
      'customer-register-approved',
      regC.status === 201 && regC.json.user && regC.json.user.role === 'customer' &&
        regC.json.user.status === 'approved' && !!jarC && !!customerId,
      JSON.stringify(regC.json).slice(0, 200)
    );

    // Owner registration creates a pending application; role/status forced.
    const regA = await post('/api/auth/owner-register', {
      ...OWNER_A,
      confirmPassword: OWNER_A.password,
      role: 'super_admin',
      status: 'approved',
    });
    const jarA = regA.raw ? sessionCookieFrom(regA.raw) : '';
    const ownerAId = regA.json.user && regA.json.user.id;
    check(
      'owner-register-pending',
      regA.status === 201 && regA.json.ok === true && regA.json.user &&
        regA.json.user.role === 'owner' && regA.json.user.status === 'pending' &&
        regA.json.user.businessName === OWNER_A.businessName && !!jarA && !!ownerAId,
      JSON.stringify(regA.json).slice(0, 300)
    );
    check(
      'owner-register-no-secret-leak',
      !('passwordHash' in (regA.json.user || {})) && !JSON.stringify(regA.json).includes(OWNER_A.password)
    );
    const meA = await get('/api/auth/me', jarA);
    check(
      'owner-me-pending',
      meA.status === 200 && meA.json.authenticated === true && meA.json.user &&
        meA.json.user.status === 'pending' && meA.json.user.businessName === OWNER_A.businessName,
      JSON.stringify(meA.json).slice(0, 200)
    );

    // Duplicates + field validation.
    const dup = await post('/api/auth/owner-register', { ...OWNER_A, confirmPassword: OWNER_A.password });
    check('owner-register-duplicate-409', dup.status === 409 && dup.json.error === 'email_already_registered', JSON.stringify(dup.json));
    const noBiz = await post('/api/auth/owner-register', {
      fullName: 'No Biz', email: 'nobiz@test.dz', password: 'NoBiz1234!', confirmPassword: 'NoBiz1234!',
      phone: '+213663000300', businessName: '', wilaya: '16', commune: 'X', businessDescription: 'desc',
    });
    check('owner-register-no-biz-400', noBiz.status === 400, JSON.stringify(noBiz.json));
    const badWilaya = await post('/api/auth/owner-register', {
      fullName: 'Bad Wilaya', email: 'badwilaya@test.dz', password: 'BadWil1234!', confirmPassword: 'BadWil1234!',
      phone: '+213663000300', businessName: 'Biz', wilaya: '99', commune: 'X', businessDescription: 'desc',
    });
    check('owner-register-bad-wilaya-400', badWilaya.status === 400, JSON.stringify(badWilaya.json));
    const badPhone = await post('/api/auth/owner-register', {
      fullName: 'Bad Phone', email: 'badphone@test.dz', password: 'BadPhone12!', confirmPassword: 'BadPhone12!',
      phone: 'abc', businessName: 'Biz', wilaya: '16', commune: 'X', businessDescription: 'desc',
    });
    check('owner-register-bad-phone-400', badPhone.status === 400, JSON.stringify(badPhone.json));
    const weak = await post('/api/auth/owner-register', {
      fullName: 'Weak Pass', email: 'weakpass@test.dz', password: 'short', confirmPassword: 'short',
      phone: '+213663000300', businessName: 'Biz', wilaya: '16', commune: 'X', businessDescription: 'desc',
    });
    check('owner-register-weak-400', weak.status === 400, JSON.stringify(weak.json));
    const mismatch = await post('/api/auth/owner-register', {
      fullName: 'Mismatch', email: 'mismatch8@test.dz', password: 'Mismatch12!', confirmPassword: 'Mismatch13!',
      phone: '+213663000300', businessName: 'Biz', wilaya: '16', commune: 'X', businessDescription: 'desc',
    });
    check('owner-register-mismatch-400', mismatch.status === 400, JSON.stringify(mismatch.json));

    // Pending owner cannot create halls or decide inquiries.
    const pendCreate = await post('/api/owner/halls', HALL_A, jarA);
    check(
      'pending-cannot-create-403',
      pendCreate.status === 403 && pendCreate.json.error === 'owner_pending_approval',
      JSON.stringify(pendCreate.json)
    );
    const guestBook = await post('/api/inquiries', {
      hallId: 'h-alger-royal', name: 'Guest Visitor', phone: '+213664000400',
      date: '2027-08-15', guests: 150, message: '', consent: true, lang: 'fr',
    });
    const guestRef = guestBook.json.reference;
    check('guest-booking-201', guestBook.status === 201 && /^WAL-[A-Z0-9]{6}$/.test(guestRef || ''), JSON.stringify(guestBook.json));
    const pendDecide = await post(`/api/owner/inquiries/${guestRef}/decision`, { decision: 'accept' }, jarA);
    check(
      'pending-cannot-decide-403',
      pendDecide.status === 403 && pendDecide.json.error === 'owner_pending_approval',
      JSON.stringify(pendDecide.json)
    );
    const pendTour = await put('/api/owner/halls/does-not-exist/tour', { tourScenes: [] }, jarA);
    check(
      'pending-cannot-tour-403',
      pendTour.status === 403 && pendTour.json.error === 'owner_pending_approval',
      JSON.stringify(pendTour.json)
    );

    // Super admin provisioning + metrics + applications list.
    const adminLogin = await post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const jarAdmin = adminLogin.raw ? sessionCookieFrom(adminLogin.raw) : '';
    check(
      'admin-provisioned',
      adminLogin.status === 200 && adminLogin.json.user && adminLogin.json.user.role === 'super_admin' &&
        adminLogin.json.user.status === 'approved' && !!jarAdmin,
      JSON.stringify(adminLogin.json).slice(0, 200)
    );
    const metrics = await get('/api/admin/metrics', jarAdmin);
    const mk = metrics.json || {};
    check(
      'admin-metrics',
      metrics.status === 200 && typeof mk.totalCustomers === 'number' && typeof mk.totalOwners === 'number' &&
        typeof mk.pendingOwners === 'number' && typeof mk.approvedOwners === 'number' &&
        typeof mk.rejectedOwners === 'number' && typeof mk.suspendedOwners === 'number' &&
        typeof mk.totalHalls === 'number' && typeof mk.publishedHalls === 'number' &&
        mk.pendingOwners >= 1 && mk.totalOwners >= 2,
      JSON.stringify(mk)
    );
    const ownersList = await get('/api/admin/owners', jarAdmin);
    const appA = (ownersList.json.owners || []).find((o) => o.email === OWNER_A.email);
    check(
      'admin-owners-list',
      ownersList.status === 200 && !!appA && appA.status === 'pending' &&
        appA.businessName === OWNER_A.businessName && appA.phone === OWNER_A.phone &&
        appA.wilaya === OWNER_A.wilaya && appA.commune === OWNER_A.commune &&
        appA.businessDescription === OWNER_A.businessDescription &&
        typeof appA.createdAt === 'string' && appA.hallCount === 0,
      JSON.stringify(appA).slice(0, 300)
    );
    check('admin-owners-no-secret-leak', !JSON.stringify(ownersList.json).includes('passwordHash'));

    // Admin status transitions: invalid / unknown / non-owner rejected.
    const badStatus = await post(`/api/admin/owners/${ownerAId}/status`, { status: 'pending' }, jarAdmin);
    check('admin-invalid-status-400', badStatus.status === 400 && badStatus.json.error === 'invalid_status');
    const unknownOwner = await post('/api/admin/owners/does-not-exist/status', { status: 'approved' }, jarAdmin);
    check('admin-unknown-404', unknownOwner.status === 404 && unknownOwner.json.error === 'owner_not_found');
    const nonOwner = await post(`/api/admin/owners/${customerId}/status`, { status: 'approved' }, jarAdmin);
    check('admin-non-owner-404', nonOwner.status === 404 && nonOwner.json.error === 'owner_not_found');

    // Approve A -> approved, then A creates Hall A.
    const approveA = await post(`/api/admin/owners/${ownerAId}/status`, { status: 'approved' }, jarAdmin);
    check('admin-approve-200', approveA.status === 200 && approveA.json.owner && approveA.json.owner.status === 'approved');
    const meA2 = await get('/api/auth/me', jarA);
    check('owner-approved-me', meA2.json.user && meA2.json.user.status === 'approved', JSON.stringify(meA2.json).slice(0, 200));
    const created = await post('/api/owner/halls', HALL_A, jarA);
    const hallAId = created.json.hall && created.json.hall.id;
    check(
      'approved-creates-hall-201',
      created.status === 201 && !!hallAId && created.json.hall.ownerId === ownerAId,
      JSON.stringify(created.json).slice(0, 300)
    );
    const ownListA = await get('/api/owner/halls', jarA);
    check(
      'owner-a-list-own-hall',
      ownListA.status === 200 && Array.isArray(ownListA.json.halls) && ownListA.json.halls.length === 1 &&
        ownListA.json.halls[0].id === hallAId,
      `count=${ownListA.json.halls ? ownListA.json.halls.length : '?'}`
    );
    const searchVisible = await get(`/api/halls/search?commune=${encodeURIComponent(HALL_A.commune)}`);
    check(
      'hall-a-public-search',
      searchVisible.status === 200 && (searchVisible.json.halls || []).some((h) => h.id === hallAId),
      `count=${searchVisible.json.count}`
    );

    // Owner B registers, gets approved, and is fully isolated from Hall A.
    const regB = await post('/api/auth/owner-register', { ...OWNER_B, confirmPassword: OWNER_B.password });
    const jarB = regB.raw ? sessionCookieFrom(regB.raw) : '';
    const ownerBId = regB.json.user && regB.json.user.id;
    check('owner-b-register-pending', regB.status === 201 && regB.json.user && regB.json.user.status === 'pending' && !!jarB);
    const approveB = await post(`/api/admin/owners/${ownerBId}/status`, { status: 'approved' }, jarAdmin);
    check('owner-b-approved', approveB.status === 200 && approveB.json.owner.status === 'approved');

    const crossUpdate = await put(`/api/owner/halls/${encodeURIComponent(hallAId)}`, { priceDzd: 1 }, jarB);
    check('cross-owner-update-403', crossUpdate.status === 403 && crossUpdate.json.error === 'forbidden', JSON.stringify(crossUpdate.json));
    const crossDelete = await del(`/api/owner/halls/${encodeURIComponent(hallAId)}`, undefined, jarB);
    check('cross-owner-delete-403', crossDelete.status === 403 && crossDelete.json.error === 'forbidden', JSON.stringify(crossDelete.json));
    const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const crossPhoto = await post(`/api/owner/halls/${encodeURIComponent(hallAId)}/photos`, {
      imageBase64: tinyPngB64, mimeType: 'image/png',
    }, jarB);
    check('cross-owner-photo-403', crossPhoto.status === 403 && crossPhoto.json.error === 'forbidden', JSON.stringify(crossPhoto.json));
    const ownListB = await get('/api/owner/halls', jarB);
    const idsB = new Set((ownListB.json.halls || []).map((h) => h.id));
    check('cross-owner-list-excludes-a', ownListB.status === 200 && !idsB.has(hallAId), `bCount=${ownListB.json.halls ? ownListB.json.halls.length : '?'}`);

    // Inquiry isolation: only the owning owner sees and decides Hall A inquiries.
    const bookA = await post('/api/inquiries', {
      hallId: hallAId, name: 'Hall A Client', phone: '+213665000500',
      date: '2027-11-20', guests: 150, message: 'isolation-test', consent: true, lang: 'fr',
    }, jarC);
    const refA = bookA.json.reference;
    check('booking-hall-a-201', bookA.status === 201 && /^WAL-[A-Z0-9]{6}$/.test(refA || ''), JSON.stringify(bookA.json));
    const inboxA = await get('/api/owner/inquiries', jarA);
    const refsA = new Set((inboxA.json.inquiries || []).map((i) => i.reference));
    check('owner-a-sees-own-inquiry', inboxA.status === 200 && refsA.has(refA), `count=${inboxA.json.count}`);
    const inboxB = await get('/api/owner/inquiries', jarB);
    const refsB = new Set((inboxB.json.inquiries || []).map((i) => i.reference));
    check('owner-b-cannot-see-a-inquiry', inboxB.status === 200 && !refsB.has(refA), `bCount=${inboxB.json.count}`);
    const crossDecide = await post(`/api/owner/inquiries/${refA}/decision`, { decision: 'accept' }, jarB);
    check('owner-b-cannot-decide-a-403', crossDecide.status === 403 && crossDecide.json.error === 'forbidden', JSON.stringify(crossDecide.json));
    const decideA = await post(`/api/owner/inquiries/${refA}/decision`, { decision: 'accept', note: 'approved in test' }, jarA);
    check('owner-a-decide-200', decideA.status === 200 && decideA.json.status === 'confirmed', JSON.stringify(decideA.json));

    // Suspend A -> 403 on owner routes, Hall A hidden from public discovery.
    const suspendA = await post(`/api/admin/owners/${ownerAId}/status`, { status: 'suspended' }, jarAdmin);
    check('admin-suspend-200', suspendA.status === 200 && suspendA.json.owner.status === 'suspended');
    const suspList = await get('/api/owner/halls', jarA);
    check(
      'suspended-list-403',
      suspList.status === 403 && suspList.json.error === 'account_suspended',
      JSON.stringify(suspList.json)
    );
    const suspCreate = await post('/api/owner/halls', HALL_A, jarA);
    check(
      'suspended-create-403',
      suspCreate.status === 403 && suspCreate.json.error === 'account_suspended',
      JSON.stringify(suspCreate.json)
    );
    const searchHidden = await get(`/api/halls/search?commune=${encodeURIComponent(HALL_A.commune)}`);
    check(
      'suspended-hall-hidden-search',
      searchHidden.status === 200 && !(searchHidden.json.halls || []).some((h) => h.id === hallAId),
      `count=${searchHidden.json.count}`
    );
    const rankHidden = await post('/api/ai/rank', { criteria: {}, lang: 'fr' });
    check(
      'suspended-hall-hidden-rank',
      rankHidden.status === 200 && !(rankHidden.json.halls || []).some((h) => h.id === hallAId) &&
        (rankHidden.json.halls || []).length >= 14,
      `count=${(rankHidden.json.halls || []).length}`
    );

    // Admin guards: customer + owner get 403, anonymous gets 401.
    const custMetrics = await get('/api/admin/metrics', jarC);
    check('admin-guard-customer-403', custMetrics.status === 403 && custMetrics.json.error === 'forbidden');
    const ownerMetrics = await get('/api/admin/metrics', jarB);
    check('admin-guard-owner-403', ownerMetrics.status === 403 && ownerMetrics.json.error === 'forbidden');
    const ownerList = await get('/api/admin/owners', jarB);
    check('admin-guard-owner-list-403', ownerList.status === 403 && ownerList.json.error === 'forbidden');
    const anonMetrics = await get('/api/admin/metrics');
    check('admin-guard-anon-401', anonMetrics.status === 401 && anonMetrics.json.error === 'unauthorized');
    const custStatus = await post(`/api/admin/owners/${ownerBId}/status`, { status: 'suspended' }, jarC);
    check('admin-guard-customer-status-403', custStatus.status === 403 && custStatus.json.error === 'forbidden');

    // Reactivate A -> workspace and public visibility restored.
    const reactivateA = await post(`/api/admin/owners/${ownerAId}/status`, { status: 'approved' }, jarAdmin);
    check('admin-reactivate-200', reactivateA.status === 200 && reactivateA.json.owner.status === 'approved');
    const relistA = await get('/api/owner/halls', jarA);
    check('reactivated-list-200', relistA.status === 200 && (relistA.json.halls || []).some((h) => h.id === hallAId));
    const searchBack = await get(`/api/halls/search?commune=${encodeURIComponent(HALL_A.commune)}`);
    check('reactivated-search-visible', (searchBack.json.halls || []).some((h) => h.id === hallAId));

    // Rejected B -> 403 account_rejected on owner routes.
    const rejectB = await post(`/api/admin/owners/${ownerBId}/status`, { status: 'rejected' }, jarAdmin);
    check('admin-reject-200', rejectB.status === 200 && rejectB.json.owner.status === 'rejected');
    const rejList = await get('/api/owner/halls', jarB);
    check('rejected-list-403', rejList.status === 403 && rejList.json.error === 'account_rejected', JSON.stringify(rejList.json));
    const rejCreate = await post('/api/owner/halls', HALL_A, jarB);
    check('rejected-create-403', rejCreate.status === 403 && rejCreate.json.error === 'account_rejected', JSON.stringify(rejCreate.json));

    // Passwords are stored hashed, never plaintext.
    const usersFile = path.join(DATA, 'users.json');
    if (fs.existsSync(usersFile)) {
      const rawUsers = fs.readFileSync(usersFile, 'utf8');
      let stored = [];
      try {
        stored = JSON.parse(rawUsers);
      } catch {
        stored = [];
      }
      check(
        'passwords-hashed',
        Array.isArray(stored) && stored.length >= 5 &&
          stored.every((u) => typeof u.passwordHash === 'string' && u.passwordHash.startsWith('scrypt:')) &&
          !rawUsers.includes(OWNER_A.password) && !rawUsers.includes(OWNER_B.password) &&
          !rawUsers.includes(CUSTOMER.password) && !rawUsers.includes(ADMIN_PASSWORD) &&
          !rawUsers.includes(OWNER_PASSWORD),
        `users=${Array.isArray(stored) ? stored.length : '?'}`
      );
    } else {
      check('passwords-hashed', true, 'users.json absent (mariadb mode)');
    }
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
  console.log(failures ? `${failures} FAILURES` : 'ALL MULTI-OWNER TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
