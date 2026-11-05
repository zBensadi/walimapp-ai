'use strict';
// WalimApp AI — auth & security utilities (Node 22 built-ins only).
//
// Passwords: crypto.scrypt with a random 16-byte salt, timing-safe verify.
// Sessions: 32-byte hex tokens in an HttpOnly SameSite=Lax cookie, 7-day TTL.
// Rate limiting: in-memory sliding window, 10 attempts / 60s per IP+action.

const crypto = require('node:crypto');

const SESSION_COOKIE = 'wa_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE = 604800; // 7 days in seconds

// --- password hashing ---------------------------------------------------------

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  try {
    if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// --- sessions ------------------------------------------------------------------

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function newExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key || key in out) continue;
    let value = part.slice(idx + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function sessionCookie(token) {
  let cookie = `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
  if (process.env.NODE_ENV === 'production') cookie += '; Secure';
  return cookie;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

// --- rate limiting ---------------------------------------------------------------

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 10;
const buckets = new Map();

function allowRate(ip, action) {
  const key = `${ip || 'unknown'}:${action || 'default'}`;
  const now = Date.now();
  let arr = buckets.get(key);
  if (!arr) {
    arr = [];
    buckets.set(key, arr);
  }
  while (arr.length > 0 && arr[0] <= now - RATE_WINDOW_MS) arr.shift();
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  return true;
}

function resetRateLimits() {
  buckets.clear();
}

// --- input validation -------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validEmail(email) {
  return EMAIL_RE.test(normalizeEmail(email));
}

function validPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function validName(name) {
  const trimmed = String(name || '').trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

function publicUser(user) {
  if (!user) return null;
  const out = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status || 'approved',
  };
  // Owner application details (drives the pending/approved workspace UI).
  for (const k of ['phone', 'businessName', 'wilaya', 'commune', 'businessDescription']) {
    if (user[k] != null && user[k] !== '') out[k] = user[k];
  }
  if (user.createdAt) out.createdAt = user.createdAt;
  return out;
}

// --- demo owner sync ---------------------------------------------------------------

async function ensureOwnerUser() {
  const email = normalizeEmail(process.env.OWNER_EMAIL || '');
  const password = process.env.OWNER_PASSWORD || '';
  if (!email || !password || !EMAIL_RE.test(email)) return null;
  const storage = require('./storage');
  let user = await storage.findUserByEmail(email);
  if (!user) {
    try {
      user = await storage.createUser({
        id: crypto.randomUUID(),
        email,
        passwordHash: hashPassword(password),
        fullName: 'Owner',
        role: 'owner',
        status: 'approved',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err && err.code === 'DUPLICATE_EMAIL') {
        user = await storage.findUserByEmail(email);
      } else {
        throw err;
      }
    }
    return user;
  }
  if (user.role !== 'owner') return user;
  const updates = {};
  if (!verifyPassword(password, user.passwordHash)) updates.passwordHash = hashPassword(password);
  if (!user.status) updates.status = 'approved';
  if (Object.keys(updates).length) {
    await storage.updateUser(user.id, updates);
    user = await storage.findUserById(user.id);
  }
  return user;
}

async function ensureAdminUser() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || '');
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password || !EMAIL_RE.test(email)) return null;
  const storage = require('./storage');
  let user = await storage.findUserByEmail(email);
  if (!user) {
    try {
      user = await storage.createUser({
        id: crypto.randomUUID(),
        email,
        passwordHash: hashPassword(password),
        fullName: 'Super Admin',
        role: 'super_admin',
        status: 'approved',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err && err.code === 'DUPLICATE_EMAIL') {
        user = await storage.findUserByEmail(email);
      } else {
        throw err;
      }
    }
    return user;
  }
  if (user.role !== 'super_admin') return user;
  const updates = {};
  if (!verifyPassword(password, user.passwordHash)) updates.passwordHash = hashPassword(password);
  if (!user.status) updates.status = 'approved';
  if (Object.keys(updates).length) {
    await storage.updateUser(user.id, updates);
    user = await storage.findUserById(user.id);
  }
  return user;
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  SESSION_MAX_AGE,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  newExpiry,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  allowRate,
  resetRateLimits,
  normalizeEmail,
  validEmail,
  validPassword,
  validName,
  publicUser,
  ensureOwnerUser,
  ensureAdminUser,
};
