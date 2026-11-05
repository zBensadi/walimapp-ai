'use strict';
// WalimApp AI — dual-mode storage engine.
//
// Uses MariaDB (via `mysql2/promise`) when DB_HOST/DB_USER/DB_NAME are
// configured AND a connection succeeds; otherwise transparently falls back to
// atomic JSON files in data/ (users.json, sessions.json, inquiries.json).
//
// File mode writes atomically (temp file + rename) behind a serialized write
// queue so concurrent read-modify-write cycles cannot interleave.

const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA, 'users.json');
const SESSIONS_FILE = path.join(DATA, 'sessions.json');
const INQUIRIES_FILE = path.join(DATA, 'inquiries.json');
const HALLS_FILE = path.join(DATA, 'halls.json');

function dupError() {
  return Object.assign(new Error('duplicate_email'), { code: 'DUPLICATE_EMAIL' });
}

function forbiddenError() {
  return Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
}

// --- database pool (lazy) ----------------------------------------------------

function dbConfig() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) return null;
  return {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD || '',
    database: DB_NAME,
    port: Number(DB_PORT || 3306),
  };
}

let pool = null;
let dbAvailable = null; // null = undecided, true/false = decided

async function getPool() {
  if (dbAvailable === false) return null;
  if (pool) return pool;
  const cfg = dbConfig();
  if (!cfg) {
    dbAvailable = false;
    return null;
  }
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch {
    dbAvailable = false; // mysql2 not installed -> file mode
    return null;
  }
  try {
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    });
    await pool.query('SELECT 1');
    dbAvailable = true;
    return pool;
  } catch {
    try {
      await pool.end();
    } catch { /* best effort */ }
    pool = null;
    dbAvailable = false;
    return null;
  }
}

const CONNECTION_ERRORS = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

function isConnectionError(err) {
  if (!err) return false;
  if (CONNECTION_ERRORS.has(err.code)) return true;
  return typeof err.message === 'string' && err.message.includes('Pool is closed');
}

async function disableDb() {
  dbAvailable = false;
  if (pool) {
    try {
      await pool.end();
    } catch { /* best effort */ }
    pool = null;
  }
}

// Runs dbFn(pool) when MariaDB is reachable, else fileFn(). A mid-run
// connection failure transparently degrades to file mode for the operation.
async function withDbOrFile(dbFn, fileFn) {
  const p = await getPool();
  if (!p) return fileFn();
  try {
    return await dbFn(p);
  } catch (err) {
    if (err && err.code === 'DUPLICATE_EMAIL') throw err;
    if (isConnectionError(err)) {
      await disableDb();
      return fileFn();
    }
    throw err;
  }
}

async function getMode() {
  return (await getPool()) ? 'mariadb' : 'file';
}

// --- file-mode helpers -------------------------------------------------------

function readJsonFile(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function atomicWriteFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// Serializes whole read-modify-write cycles, not just the write syscall.
let writeChain = Promise.resolve();
function withWriteLock(fn) {
  const run = writeChain.then(() => fn());
  writeChain = run.catch(() => {});
  return run;
}

function sessionExpired(expiresAt) {
  const exp = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
  return !Number.isFinite(exp) || exp <= Date.now();
}

// --- file-mode operations ----------------------------------------------------

function fileFindUserByEmail(email) {
  const want = String(email || '').toLowerCase();
  return readJsonFile(USERS_FILE, []).find((u) => u && u.email === want) || null;
}

function fileFindUserById(id) {
  return readJsonFile(USERS_FILE, []).find((u) => u && u.id === id) || null;
}

function fileCreateUser(user) {
  return withWriteLock(() => {
    const users = readJsonFile(USERS_FILE, []);
    if (users.some((u) => u && u.email === user.email)) throw dupError();
    users.push({ ...user });
    atomicWriteFile(USERS_FILE, users);
    return { ...user };
  });
}

function fileUpdateUser(id, updates) {
  return withWriteLock(() => {
    const users = readJsonFile(USERS_FILE, []);
    const idx = users.findIndex((u) => u && u.id === id);
    if (idx < 0) return null;
    users[idx] = { ...users[idx], ...updates };
    atomicWriteFile(USERS_FILE, users);
    return { ...users[idx] };
  });
}

function fileSaveSession(session) {
  return withWriteLock(() => {
    const sessions = readJsonFile(SESSIONS_FILE, []).filter((s) => s && s.token !== session.token);
    sessions.push({ ...session });
    atomicWriteFile(SESSIONS_FILE, sessions);
    return { ...session };
  });
}

async function fileFindSession(token) {
  const found = readJsonFile(SESSIONS_FILE, []).find((s) => s && s.token === token) || null;
  if (!found) return null;
  if (sessionExpired(found.expiresAt)) {
    await fileDeleteSession(token);
    return null;
  }
  return { ...found };
}

function fileDeleteSession(token) {
  return withWriteLock(() => {
    const sessions = readJsonFile(SESSIONS_FILE, []).filter((s) => s && s.token !== token);
    atomicWriteFile(SESSIONS_FILE, sessions);
  });
}

function fileLoadInquiries() {
  return readJsonFile(INQUIRIES_FILE, []).map((i) => ({ ...i }));
}

function fileFindInquiryByReference(ref) {
  return fileLoadInquiries().find((i) => i.reference === ref) || null;
}

function fileFindInquiriesByCustomer(customerId) {
  return fileLoadInquiries().filter((i) => i.customerId === customerId);
}

function fileSaveInquiry(inquiry) {
  return withWriteLock(() => {
    const list = readJsonFile(INQUIRIES_FILE, []);
    list.push({ ...inquiry });
    atomicWriteFile(INQUIRIES_FILE, list);
    return { ...inquiry };
  });
}

function fileUpdateInquiry(ref, updates) {
  return withWriteLock(() => {
    const list = readJsonFile(INQUIRIES_FILE, []);
    const idx = list.findIndex((i) => i && i.reference === ref);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...updates };
    atomicWriteFile(INQUIRIES_FILE, list);
    return { ...list[idx] };
  });
}

// --- halls file-mode (data/halls.json keeps { halls: [...] } shape) ---

function readHallsFile() {
  try {
    const raw = fs.readFileSync(HALLS_FILE, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.halls)) return parsed.halls;
    return [];
  } catch {
    return [];
  }
}

function atomicWriteHalls(halls) {
  fs.mkdirSync(path.dirname(HALLS_FILE), { recursive: true });
  const tmp = `${HALLS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ halls }, null, 2));
  fs.renameSync(tmp, HALLS_FILE);
}

function cloneHall(h) {
  return JSON.parse(JSON.stringify(h));
}

function fileGetHalls() {
  return readHallsFile().map(cloneHall);
}

function fileGetHallById(id) {
  const found = readHallsFile().find((h) => h && h.id === id) || null;
  return found ? cloneHall(found) : null;
}

function fileCreateHall(hallData, ownerId) {
  return withWriteLock(() => {
    const list = readHallsFile();
    if (hallData && hallData.id && list.some((h) => h && h.id === hallData.id)) {
      throw Object.assign(new Error('duplicate_hall'), { code: 'DUPLICATE_HALL' });
    }
    const hall = { ...hallData, ownerId };
    if (!Array.isArray(hall.photos)) hall.photos = [];
    list.push(hall);
    atomicWriteHalls(list);
    return cloneHall(hall);
  });
}

function fileUpdateHall(id, updates, ownerId) {
  return withWriteLock(() => {
    const list = readHallsFile();
    const idx = list.findIndex((h) => h && h.id === id);
    if (idx < 0) return null;
    const cur = list[idx];
    if (cur.ownerId && cur.ownerId !== ownerId) throw forbiddenError();
    const safe = { ...(updates || {}) };
    delete safe.id;
    delete safe.ownerId;
    const merged = { ...cur, ...safe, id: cur.id, ownerId: cur.ownerId || ownerId };
    if (!Array.isArray(merged.photos)) merged.photos = [];
    list[idx] = merged;
    atomicWriteHalls(list);
    return cloneHall(merged);
  });
}

function fileDeleteHall(id, ownerId) {
  return withWriteLock(() => {
    const list = readHallsFile();
    const idx = list.findIndex((h) => h && h.id === id);
    if (idx < 0) return null;
    const cur = list[idx];
    if (cur.ownerId && cur.ownerId !== ownerId) throw forbiddenError();
    const [removed] = list.splice(idx, 1);
    atomicWriteHalls(list);
    return cloneHall(removed);
  });
}

function fileClaimUnownedHalls(ownerId) {
  return withWriteLock(() => {
    const list = readHallsFile();
    let changed = false;
    for (const h of list) {
      if (h && !h.ownerId) {
        h.ownerId = ownerId;
        changed = true;
      }
    }
    if (changed) atomicWriteHalls(list);
    return list.map(cloneHall);
  });
}

// --- MariaDB row mapping -----------------------------------------------------

function normalizeUser(u) {
  if (!u) return null;
  // Legacy records predate roles/statuses: missing status means approved.
  if (!u.status) return { ...u, status: 'approved' };
  return u;
}

function mapUserRow(r) {
  if (!r) return null;
  return normalizeUser({
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    fullName: r.full_name,
    role: r.role,
    status: r.status,
    phone: r.phone ?? null,
    businessName: r.business_name ?? null,
    wilaya: r.wilaya ?? null,
    commune: r.commune ?? null,
    businessDescription: r.business_description ?? null,
    createdAt: r.created_at,
  });
}

function mapSessionRow(r) {
  if (!r) return null;
  return {
    token: r.token,
    userId: r.user_id,
    role: r.role,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  };
}

function mapInquiryRow(r) {
  if (!r) return null;
  let hallName = r.hall_name;
  if (typeof hallName === 'string') {
    try {
      hallName = JSON.parse(hallName);
    } catch { /* keep raw string */ }
  }
  const out = {
    reference: r.reference,
    status: r.status,
    hallId: r.hall_id,
    hallName,
    wilaya: r.wilaya,
    name: r.name,
    phone: r.phone,
    date: r.date,
    guests: r.guests,
    message: r.message || '',
    consent: r.consent === 1 || r.consent === true,
    consentAt: r.consent_at,
    lang: r.lang,
    createdAt: r.created_at,
    customerId: r.customer_id || null,
  };
  if (r.owner_note != null) out.ownerNote = r.owner_note;
  if (r.decided_at != null) out.decidedAt = r.decided_at;
  return out;
}

function inquiryToColumns(i) {
  return {
    reference: i.reference,
    status: i.status,
    hall_id: i.hallId,
    hall_name: typeof i.hallName === 'string' ? i.hallName : JSON.stringify(i.hallName ?? null),
    wilaya: i.wilaya,
    name: i.name,
    phone: i.phone,
    date: i.date,
    guests: i.guests,
    message: i.message || '',
    consent: i.consent ? 1 : 0,
    consent_at: i.consentAt || null,
    lang: i.lang || 'fr',
    created_at: i.createdAt,
    owner_note: i.ownerNote ?? null,
    decided_at: i.decidedAt ?? null,
    customer_id: i.customerId ?? null,
  };
}

function isDupEntry(err) {
  return err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062);
}

function mapHallRow(r) {
  if (!r) return null;
  let payload = {};
  if (typeof r.payload === 'string') {
    try {
      payload = JSON.parse(r.payload);
    } catch {
      payload = {};
    }
  } else if (r.payload && typeof r.payload === 'object') {
    payload = r.payload;
  }
  const hall = { ...payload, id: r.id, ownerId: r.owner_id || payload.ownerId || null };
  if (!Array.isArray(hall.photos)) hall.photos = [];
  return hall;
}

// Adds Task 08 user columns to pre-existing MariaDB deployments (best effort,
// runs once per process; fresh installs get them from schema.sql).
let userColumnsEnsured = false;
async function ensureUserColumns(p) {
  if (userColumnsEnsured) return;
  userColumnsEnsured = true;
  const alters = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'approved'",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32) NULL',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name VARCHAR(120) NULL',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS wilaya VARCHAR(8) NULL',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS commune VARCHAR(60) NULL',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS business_description TEXT NULL',
  ];
  for (const sql of alters) {
    try {
      await p.query(sql);
    } catch {
      /* best effort: file mode or older server */
    }
  }
}

async function ensureHallsTable(p) {
  await p.query(
    'CREATE TABLE IF NOT EXISTS halls (' +
      'id VARCHAR(64) PRIMARY KEY,' +
      'owner_id VARCHAR(64) NULL,' +
      'payload MEDIUMTEXT NOT NULL,' +
      'KEY idx_halls_owner (owner_id)' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  );
}

async function seedHallsFromFile(p) {
  const seed = readHallsFile();
  for (const h of seed) {
    if (!h || !h.id) continue;
    const ownerId = h.ownerId || null;
    const payload = JSON.stringify({ ...h, ownerId });
    try {
      await p.query('INSERT IGNORE INTO halls (id, owner_id, payload) VALUES (?, ?, ?)', [h.id, ownerId, payload]);
    } catch {
      /* best effort */
    }
  }
}

// --- public interface --------------------------------------------------------

async function findUserByEmail(email) {
  const want = String(email || '').toLowerCase();
  return withDbOrFile(
    async (p) => {
      await ensureUserColumns(p);
      const [rows] = await p.query('SELECT * FROM users WHERE email = ? LIMIT 1', [want]);
      return mapUserRow(rows[0]);
    },
    async () => normalizeUser(fileFindUserByEmail(want))
  );
}

async function findUserById(id) {
  return withDbOrFile(
    async (p) => {
      await ensureUserColumns(p);
      const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      return mapUserRow(rows[0]);
    },
    async () => normalizeUser(fileFindUserById(id))
  );
}

async function loadUsers() {
  return withDbOrFile(
    async (p) => {
      await ensureUserColumns(p);
      const [rows] = await p.query('SELECT * FROM users');
      return rows.map(mapUserRow);
    },
    async () => readJsonFile(USERS_FILE, []).map((u) => normalizeUser({ ...u }))
  );
}

async function findOwners() {
  return withDbOrFile(
    async (p) => {
      await ensureUserColumns(p);
      const [rows] = await p.query("SELECT * FROM users WHERE role = 'owner'");
      return rows.map(mapUserRow);
    },
    async () => readJsonFile(USERS_FILE, []).filter((u) => u && u.role === 'owner').map((u) => normalizeUser({ ...u }))
  );
}

async function createUser({ id, email, passwordHash, fullName, role, status, phone, businessName, wilaya, commune, businessDescription, createdAt }) {
  const user = {
    id,
    email: String(email).toLowerCase(),
    passwordHash,
    fullName,
    role,
    status: status || 'approved',
    phone: phone ?? null,
    businessName: businessName ?? null,
    wilaya: wilaya ?? null,
    commune: commune ?? null,
    businessDescription: businessDescription ?? null,
    createdAt,
  };
  return withDbOrFile(
    async (p) => {
      await ensureUserColumns(p);
      try {
        await p.query(
          'INSERT INTO users (id, email, password_hash, full_name, role, status, phone, business_name, wilaya, commune, business_description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [user.id, user.email, user.passwordHash, user.fullName, user.role, user.status, user.phone, user.businessName, user.wilaya, user.commune, user.businessDescription, user.createdAt]
        );
      } catch (err) {
        if (isDupEntry(err)) throw dupError();
        throw err;
      }
      return { ...user };
    },
    async () => fileCreateUser(user)
  );
}

const USER_COLUMN_MAP = {
  passwordHash: 'password_hash',
  fullName: 'full_name',
  role: 'role',
  status: 'status',
  phone: 'phone',
  businessName: 'business_name',
  wilaya: 'wilaya',
  commune: 'commune',
  businessDescription: 'business_description',
};

async function updateUser(id, updates) {
  return withDbOrFile(
    async (p) => {
      await ensureUserColumns(p);
      const sets = [];
      const vals = [];
      for (const [key, value] of Object.entries(updates || {})) {
        const col = USER_COLUMN_MAP[key];
        if (!col) continue;
        sets.push(`${col} = ?`);
        vals.push(value ?? null);
      }
      if (!sets.length) {
        const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
        return mapUserRow(rows[0]);
      }
      vals.push(id);
      await p.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
      const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      return mapUserRow(rows[0]);
    },
    async () => normalizeUser(await fileUpdateUser(id, updates))
  );
}

async function updateUserStatus(id, status) {
  return updateUser(id, { status });
}

async function saveSession({ token, userId, role, createdAt, expiresAt }) {
  const session = { token, userId, role, createdAt, expiresAt };
  return withDbOrFile(
    async (p) => {
      await p.query(
        'INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?) ' +
          'ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), role = VALUES(role), created_at = VALUES(created_at), expires_at = VALUES(expires_at)',
        [session.token, session.userId, session.role, session.createdAt, session.expiresAt]
      );
      return { ...session };
    },
    async () => fileSaveSession(session)
  );
}

async function findSession(token) {
  if (!token) return null;
  return withDbOrFile(
    async (p) => {
      const [rows] = await p.query('SELECT * FROM sessions WHERE token = ? LIMIT 1', [token]);
      const found = mapSessionRow(rows[0]);
      if (!found) return null;
      if (sessionExpired(found.expiresAt)) {
        await p.query('DELETE FROM sessions WHERE token = ?', [token]);
        return null;
      }
      return found;
    },
    async () => fileFindSession(token)
  );
}

async function deleteSession(token) {
  if (!token) return;
  return withDbOrFile(
    async (p) => {
      await p.query('DELETE FROM sessions WHERE token = ?', [token]);
    },
    async () => fileDeleteSession(token)
  );
}

async function loadInquiries() {
  return withDbOrFile(
    async (p) => {
      const [rows] = await p.query('SELECT * FROM inquiries');
      return rows.map(mapInquiryRow);
    },
    async () => fileLoadInquiries()
  );
}

async function findInquiryByReference(ref) {
  return withDbOrFile(
    async (p) => {
      const [rows] = await p.query('SELECT * FROM inquiries WHERE reference = ? LIMIT 1', [ref]);
      return mapInquiryRow(rows[0]);
    },
    async () => fileFindInquiryByReference(ref)
  );
}

async function findInquiriesByCustomer(customerId) {
  return withDbOrFile(
    async (p) => {
      const [rows] = await p.query('SELECT * FROM inquiries WHERE customer_id = ?', [customerId]);
      return rows.map(mapInquiryRow);
    },
    async () => fileFindInquiriesByCustomer(customerId)
  );
}

async function saveInquiry(inquiry) {
  const record = { customerId: null, ...inquiry };
  return withDbOrFile(
    async (p) => {
      const c = inquiryToColumns(record);
      await p.query(
        'INSERT INTO inquiries (reference, status, hall_id, hall_name, wilaya, name, phone, date, guests, message, consent, consent_at, lang, created_at, owner_note, decided_at, customer_id) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [c.reference, c.status, c.hall_id, c.hall_name, c.wilaya, c.name, c.phone, c.date, c.guests, c.message, c.consent, c.consent_at, c.lang, c.created_at, c.owner_note, c.decided_at, c.customer_id]
      );
      return { ...record };
    },
    async () => fileSaveInquiry(record)
  );
}

const INQUIRY_COLUMN_MAP = {
  status: 'status',
  hallId: 'hall_id',
  hallName: 'hall_name',
  wilaya: 'wilaya',
  name: 'name',
  phone: 'phone',
  date: 'date',
  guests: 'guests',
  message: 'message',
  consent: 'consent',
  consentAt: 'consent_at',
  lang: 'lang',
  createdAt: 'created_at',
  ownerNote: 'owner_note',
  decidedAt: 'decided_at',
  customerId: 'customer_id',
};

function toColumnValue(key, value) {
  if (key === 'hallName') return typeof value === 'string' ? value : JSON.stringify(value ?? null);
  if (key === 'consent') return value ? 1 : 0;
  return value ?? null;
}

async function updateInquiry(ref, updates) {
  return withDbOrFile(
    async (p) => {
      const sets = [];
      const vals = [];
      for (const [key, value] of Object.entries(updates || {})) {
        const col = INQUIRY_COLUMN_MAP[key];
        if (!col) continue;
        sets.push(`${col} = ?`);
        vals.push(toColumnValue(key, value));
      }
      if (sets.length) {
        vals.push(ref);
        await p.query(`UPDATE inquiries SET ${sets.join(', ')} WHERE reference = ?`, vals);
      }
      const [rows] = await p.query('SELECT * FROM inquiries WHERE reference = ? LIMIT 1', [ref]);
      return mapInquiryRow(rows[0]);
    },
    async () => fileUpdateInquiry(ref, updates)
  );
}

async function getHalls() {
  return withDbOrFile(
    async (p) => {
      await ensureHallsTable(p);
      let [rows] = await p.query('SELECT * FROM halls');
      if (!rows.length) {
        await seedHallsFromFile(p);
        [rows] = await p.query('SELECT * FROM halls');
      }
      if (!rows.length) return fileGetHalls();
      return rows.map(mapHallRow);
    },
    async () => fileGetHalls()
  );
}

async function getHallById(id) {
  return withDbOrFile(
    async (p) => {
      await ensureHallsTable(p);
      let [rows] = await p.query('SELECT * FROM halls WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) {
        const [cnt] = await p.query('SELECT COUNT(*) AS n FROM halls');
        const n = cnt && cnt[0] ? Number(cnt[0].n) : 0;
        if (n === 0) {
          await seedHallsFromFile(p);
          [rows] = await p.query('SELECT * FROM halls WHERE id = ? LIMIT 1', [id]);
        }
      }
      if (!rows.length) return fileGetHallById(id);
      return mapHallRow(rows[0]);
    },
    async () => fileGetHallById(id)
  );
}

async function createHall(hallData, ownerId) {
  const hall = { ...hallData, ownerId };
  if (!Array.isArray(hall.photos)) hall.photos = [];
  return withDbOrFile(
    async (p) => {
      await ensureHallsTable(p);
      try {
        await p.query('INSERT INTO halls (id, owner_id, payload) VALUES (?, ?, ?)', [
          hall.id,
          hall.ownerId || null,
          JSON.stringify(hall),
        ]);
      } catch (err) {
        if (isDupEntry(err)) throw Object.assign(new Error('duplicate_hall'), { code: 'DUPLICATE_HALL' });
        throw err;
      }
      try {
        await fileCreateHall(hall, ownerId);
      } catch {
        /* file mirror best effort */
      }
      return cloneHall(hall);
    },
    async () => fileCreateHall(hall, ownerId)
  );
}

async function updateHall(id, updates, ownerId) {
  return withDbOrFile(
    async (p) => {
      await ensureHallsTable(p);
      const [rows] = await p.query('SELECT * FROM halls WHERE id = ? LIMIT 1', [id]);
      let current = mapHallRow(rows[0]);
      if (!current) {
        const fileHall = fileGetHallById(id);
        if (!fileHall) return null;
        current = fileHall;
        await p.query('INSERT IGNORE INTO halls (id, owner_id, payload) VALUES (?, ?, ?)', [
          current.id,
          current.ownerId || null,
          JSON.stringify(current),
        ]);
      }
      if (current.ownerId && current.ownerId !== ownerId) throw forbiddenError();
      const safe = { ...(updates || {}) };
      delete safe.id;
      delete safe.ownerId;
      const merged = { ...current, ...safe, id: current.id, ownerId: current.ownerId || ownerId };
      if (!Array.isArray(merged.photos)) merged.photos = [];
      await p.query('UPDATE halls SET owner_id = ?, payload = ? WHERE id = ?', [
        merged.ownerId || null,
        JSON.stringify(merged),
        id,
      ]);
      try {
        await fileUpdateHall(id, { ...safe, photos: merged.photos }, merged.ownerId);
      } catch {
        /* file mirror best effort */
      }
      return cloneHall(merged);
    },
    async () => fileUpdateHall(id, updates, ownerId)
  );
}

async function deleteHall(id, ownerId) {
  return withDbOrFile(
    async (p) => {
      await ensureHallsTable(p);
      const [rows] = await p.query('SELECT * FROM halls WHERE id = ? LIMIT 1', [id]);
      let current = mapHallRow(rows[0]);
      if (!current) {
        const fileHall = fileGetHallById(id);
        if (!fileHall) return null;
        current = fileHall;
      }
      if (current.ownerId && current.ownerId !== ownerId) throw forbiddenError();
      await p.query('DELETE FROM halls WHERE id = ?', [id]);
      try {
        await fileDeleteHall(id, ownerId);
      } catch {
        /* file mirror best effort */
      }
      return cloneHall(current);
    },
    async () => fileDeleteHall(id, ownerId)
  );
}

async function claimUnownedHalls(ownerId) {
  return withDbOrFile(
    async (p) => {
      await ensureHallsTable(p);
      const [rows] = await p.query('SELECT * FROM halls WHERE owner_id IS NULL OR owner_id = ?', ['']);
      for (const r of rows) {
        const hall = mapHallRow(r);
        if (!hall || hall.ownerId) continue;
        const merged = { ...hall, ownerId };
        await p.query('UPDATE halls SET owner_id = ?, payload = ? WHERE id = ?', [
          ownerId,
          JSON.stringify(merged),
          hall.id,
        ]);
      }
      await fileClaimUnownedHalls(ownerId);
      const [all] = await p.query('SELECT * FROM halls');
      if (!all.length) return fileGetHalls();
      return all.map(mapHallRow);
    },
    async () => fileClaimUnownedHalls(ownerId)
  );
}

async function getHallsByOwner(ownerId) {
  const all = await getHalls();
  return all.filter((h) => h && h.ownerId === ownerId);
}

module.exports = {
  findUserByEmail,
  findUserById,
  loadUsers,
  findOwners,
  createUser,
  updateUser,
  updateUserStatus,
  getHallsByOwner,
  saveSession,
  findSession,
  deleteSession,
  loadInquiries,
  findInquiryByReference,
  findInquiriesByCustomer,
  saveInquiry,
  updateInquiry,
  getMode,
  getHalls,
  getHallById,
  createHall,
  updateHall,
  deleteHall,
  claimUnownedHalls,
};
