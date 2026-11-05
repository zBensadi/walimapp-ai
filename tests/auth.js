// WalimApp AI — auth + customer accounts test (no dependencies).
// Covers registration, login, sessions, logout, customer bookings,
// customer isolation, owner guards, and owner login. Snapshots and restores
// data/users.json, data/sessions.json and data/inquiries.json (exact raw
// bytes) so no test data is left behind.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 3103;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(__dirname, '..', 'data');
const SNAP_FILES = ['users.json', 'sessions.json', 'inquiries.json'].map((f) => path.join(DATA, f));
const OWNER_EMAIL = 'owner@test.dz';
const OWNER_PASSWORD = 'OwnerPassword123!';
let failures = 0;

function check(name, cond, extra) {
  if (cond) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function setCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const all = res.headers.getSetCookie();
    if (all && all.length) return all;
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function sessionCookieFrom(res) {
  for (const header of setCookieHeaders(res)) {
    const m = /^wa_session=([^;]*)/.exec(header.trim());
    if (m) return { value: m[1], raw: header };
  }
  return null;
}

async function get(p, cookie) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, { headers });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, cacheControl: r.headers.get('cache-control'), setCookies: setCookieHeaders(r) };
}

async function post(p, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, json: j, cacheControl: r.headers.get('cache-control'), setCookies: setCookieHeaders(r), raw: r };
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

    const ownerStatus = await get('/api/auth/owner-status');
    check('owner-status-configured', ownerStatus.status === 200 && ownerStatus.json.configured === true);

    // Registration: success.
    const regA = await post('/api/auth/register', {
      fullName: 'Amine Customer', email: 'amine@test.dz', password: 'Customer123', confirmPassword: 'Customer123',
    });
    const regCookie = sessionCookieFrom(regA.raw);
    check(
      'register-success',
      regA.status === 201 && regA.json.ok === true && regA.json.user && regA.json.user.role === 'customer' &&
        regA.json.user.email === 'amine@test.dz' && regA.json.user.fullName === 'Amine Customer' &&
        typeof regA.json.user.id === 'string',
      JSON.stringify(regA.json)
    );
    check('register-no-secret-leak', !('passwordHash' in regA.json.user) && !JSON.stringify(regA.json).includes('Customer123'));
    check(
      'register-sets-cookie',
      !!regCookie && /^[0-9a-f]{64}$/.test(regCookie.value) &&
        /HttpOnly/i.test(regCookie.raw) && /SameSite=Lax/i.test(regCookie.raw),
      (regCookie && regCookie.raw) || 'no cookie'
    );
    const userIdA = regA.json.user && regA.json.user.id;
    const cookieA = regCookie ? `wa_session=${regCookie.value}` : '';

    // Registration: failures.
    const dup = await post('/api/auth/register', {
      fullName: 'Amine Again', email: 'AMINE@test.dz', password: 'Customer123', confirmPassword: 'Customer123',
    });
    check('register-duplicate-409', dup.status === 409 && dup.json.error === 'email_already_registered', JSON.stringify(dup.json));
    const weakShort = await post('/api/auth/register', {
      fullName: 'Weak One', email: 'weak1@test.dz', password: 'Sh0rt', confirmPassword: 'Sh0rt',
    });
    check('register-weak-short-400', weakShort.status === 400, JSON.stringify(weakShort.json));
    const weakDigits = await post('/api/auth/register', {
      fullName: 'Weak Two', email: 'weak2@test.dz', password: 'lettersonly', confirmPassword: 'lettersonly',
    });
    check('register-weak-no-digit-400', weakDigits.status === 400, JSON.stringify(weakDigits.json));
    const badEmail = await post('/api/auth/register', {
      fullName: 'Bad Email', email: 'not-an-email', password: 'Customer123', confirmPassword: 'Customer123',
    });
    check('register-invalid-email-400', badEmail.status === 400, JSON.stringify(badEmail.json));
    const mismatch = await post('/api/auth/register', {
      fullName: 'Mismatch', email: 'mismatch@test.dz', password: 'Customer123', confirmPassword: 'Customer124',
    });
    check('register-mismatch-400', mismatch.status === 400, JSON.stringify(mismatch.json));

    // Login: valid + invalid.
    const loginA = await post('/api/auth/login', { email: 'amine@test.dz', password: 'Customer123' });
    const loginCookie = sessionCookieFrom(loginA.raw);
    check(
      'login-success',
      loginA.status === 200 && loginA.json.ok === true && loginA.json.user && loginA.json.user.id === userIdA &&
        !!loginCookie && /^[0-9a-f]{64}$/.test(loginCookie.value),
      JSON.stringify(loginA.json)
    );
    check('login-no-secret-leak', !('passwordHash' in (loginA.json.user || {})) && !JSON.stringify(loginA.json).includes('Customer123'));
    const badPass = await post('/api/auth/login', { email: 'amine@test.dz', password: 'WrongPass1' });
    check('login-wrong-password-401', badPass.status === 401 && badPass.json.error === 'invalid_credentials', JSON.stringify(badPass.json));
    const unknown = await post('/api/auth/login', { email: 'ghost@test.dz', password: 'Customer123' });
    check('login-unknown-401', unknown.status === 401 && unknown.json.error === 'invalid_credentials', JSON.stringify(unknown.json));

    // Persistent session via cookie.
    const meA = await get('/api/auth/me', cookieA);
    check(
      'me-authenticated',
      meA.status === 200 && meA.json.authenticated === true && meA.json.user && meA.json.user.id === userIdA &&
        meA.json.user.role === 'customer' && !('passwordHash' in meA.json.user),
      JSON.stringify(meA.json)
    );
    const meAnon = await get('/api/auth/me');
    check('me-anonymous', meAnon.status === 200 && meAnon.json.authenticated === false, JSON.stringify(meAnon.json));

    // Customer booking links customerId; guest booking still works.
    const bookA = await post('/api/inquiries', {
      hallId: 'h-alger-royal', name: 'Amine Customer', phone: '+213661000010',
      date: '2027-08-15', guests: 250, message: 'auth-test', consent: true, lang: 'fr',
    }, cookieA);
    const refA = bookA.json.reference;
    check('customer-booking-201', bookA.status === 201 && /^WAL-[A-Z0-9]{6}$/.test(refA || ''), JSON.stringify(bookA.json));
    const bookGuest = await post('/api/inquiries', {
      hallId: 'h-oran-emir', name: 'Guest Visitor', phone: '+213662000020',
      date: '2027-09-01', guests: 150, message: '', consent: true, lang: 'en',
    });
    const refGuest = bookGuest.json.reference;
    check('guest-booking-201', bookGuest.status === 201 && /^WAL-[A-Z0-9]{6}$/.test(refGuest || ''), JSON.stringify(bookGuest.json));

    const listA = await get('/api/customer/inquiries', cookieA);
    const refsA = new Set((listA.json.inquiries || []).map((i) => i.reference));
    const ownA = (listA.json.inquiries || []).find((i) => i.reference === refA);
    check(
      'customer-list-own',
      listA.status === 200 && typeof listA.json.count === 'number' && listA.json.counts &&
        listA.json.counts.total >= 1 && refsA.has(refA) && !refsA.has(refGuest),
      JSON.stringify({ count: listA.json.count, refs: [...refsA] })
    );
    check('customer-booking-linked', !!ownA && ownA.customerId === userIdA, JSON.stringify(ownA));
    const detailA = await get(`/api/customer/inquiries/${refA}`, cookieA);
    check(
      'customer-detail-own',
      detailA.status === 200 && detailA.json.inquiry && detailA.json.inquiry.reference === refA &&
        detailA.json.inquiry.name === 'Amine Customer' && detailA.json.inquiry.phone === '+213661000010',
      JSON.stringify(detailA.json).slice(0, 200)
    );
    const detailGuest = await get(`/api/customer/inquiries/${refGuest}`, cookieA);
    check('customer-detail-guest-404', detailGuest.status === 404 && detailGuest.json.error === 'inquiry_not_found');
    const listAnon = await get('/api/customer/inquiries');
    check('customer-list-anon-401', listAnon.status === 401, JSON.stringify(listAnon.json));

    // Isolation: customer B.
    const regB = await post('/api/auth/register', {
      fullName: 'Yasmine Customer', email: 'yasmine@test.dz', password: 'Customer456', confirmPassword: 'Customer456',
    });
    const cookieB = sessionCookieFrom(regB.raw);
    const jarB = cookieB ? `wa_session=${cookieB.value}` : '';
    const userIdB = regB.json.user && regB.json.user.id;
    check('register-b-success', regB.status === 201 && !!cookieB && !!userIdB && userIdB !== userIdA);
    const bookB = await post('/api/inquiries', {
      hallId: 'h-alger-royal', name: 'Yasmine Customer', phone: '+213663000030',
      date: '2027-10-02', guests: 200, message: '', consent: true, lang: 'fr',
    }, jarB);
    const refB = bookB.json.reference;
    check('booking-b-201', bookB.status === 201 && /^WAL-[A-Z0-9]{6}$/.test(refB || ''));
    const listB = await get('/api/customer/inquiries', jarB);
    const refsB = new Set((listB.json.inquiries || []).map((i) => i.reference));
    check('isolation-b-list', listB.status === 200 && refsB.has(refB) && !refsB.has(refA), JSON.stringify([...refsB]));
    const crossB = await get(`/api/customer/inquiries/${refA}`, jarB);
    check('isolation-b-cannot-view-a', crossB.status === 404 && crossB.json.error === 'inquiry_not_found');
    const crossA = await get(`/api/customer/inquiries/${refB}`, cookieA);
    check('isolation-a-cannot-view-b', crossA.status === 404 && crossA.json.error === 'inquiry_not_found');

    // Owner guards.
    const ownerAsCustomer = await get('/api/owner/inquiries', cookieA);
    check(
      'owner-inbox-customer-403',
      ownerAsCustomer.status === 403 && ownerAsCustomer.json.error === 'forbidden',
      JSON.stringify(ownerAsCustomer.json)
    );
    const ownerAnon = await get('/api/owner/inquiries');
    check(
      'owner-inbox-anon-401',
      ownerAnon.status === 401 && ownerAnon.json.error === 'unauthorized',
      JSON.stringify(ownerAnon.json)
    );
    const decisionAsCustomer = await post(`/api/owner/inquiries/${refA}/decision`, { decision: 'accept' }, cookieA);
    check('owner-decision-customer-403', decisionAsCustomer.status === 403 && decisionAsCustomer.json.error === 'forbidden');
    const decisionAnon = await post(`/api/owner/inquiries/${refA}/decision`, { decision: 'accept' });
    check('owner-decision-anon-401', decisionAnon.status === 401 && decisionAnon.json.error === 'unauthorized');

    // Owner login + inbox + decision.
    const ownerLogin = await post('/api/auth/login', { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    const ownerCookie = sessionCookieFrom(ownerLogin.raw);
    const jarOwner = ownerCookie ? `wa_session=${ownerCookie.value}` : '';
    check(
      'owner-login',
      ownerLogin.status === 200 && ownerLogin.json.user && ownerLogin.json.user.role === 'owner' && !!ownerCookie,
      JSON.stringify(ownerLogin.json)
    );
    const ownerInbox = await get('/api/owner/inquiries', jarOwner);
    const ownerRefs = new Set((ownerInbox.json.inquiries || []).map((i) => i.reference));
    check(
      'owner-inbox-ok',
      ownerInbox.status === 200 && ownerRefs.has(refA) && ownerRefs.has(refB) && ownerRefs.has(refGuest),
      `count=${ownerInbox.json.count}`
    );
    const ownerDecision = await post(`/api/owner/inquiries/${refGuest}/decision`, { decision: 'accept', note: 'auth test accept' }, jarOwner);
    check('owner-decision-ok', ownerDecision.status === 200 && ownerDecision.json.status === 'confirmed', JSON.stringify(ownerDecision.json));

    // Logout invalidates the session.
    const logout = await post('/api/auth/logout', {}, cookieA);
    const cleared = logout.setCookies.some((c) => /^wa_session=;/.test(c.trim()) && /Max-Age=0/i.test(c));
    check('logout-ok', logout.status === 200 && logout.json.ok === true && cleared, JSON.stringify(logout.setCookies));
    const meAfter = await get('/api/auth/me', cookieA);
    check('logout-invalidates', meAfter.status === 200 && meAfter.json.authenticated === false, JSON.stringify(meAfter.json));
    const listAfter = await get('/api/customer/inquiries', cookieA);
    check('logout-list-401', listAfter.status === 401);

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
        Array.isArray(stored) && stored.length >= 3 &&
          stored.every((u) => typeof u.passwordHash === 'string' && u.passwordHash.startsWith('scrypt:')) &&
          !rawUsers.includes('Customer123') && !rawUsers.includes('Customer456') && !rawUsers.includes(OWNER_PASSWORD),
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
  console.log(failures ? `${failures} FAILURES` : 'ALL AUTH TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
