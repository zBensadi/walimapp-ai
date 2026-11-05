// WalimApp AI — hackathon demo server (Node.js 22, zero dependencies).
// Serves the static marketplace UI and the server-side API, including all
// Meta Model API calls (keys never leave the server).
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const meta = require('./lib/meta');
const storage = require('./lib/storage');
const auth = require('./lib/auth');
const imageMeta = require('./lib/image-meta');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
// 10MB panoramas arrive as base64 JSON (~13.4MB), so the JSON cap must clear that.
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const MAX_PANORAMA_BYTES = 10 * 1024 * 1024;
const PANORAMA_RATIO_MIN = 1.8;
const PANORAMA_RATIO_MAX = 2.2;

const STYLES = ['moderne', 'traditionnel', 'oriental', 'minimaliste', 'exterieur'];
const LANGS = ['fr', 'ar', 'en'];

const wilayas = JSON.parse(fs.readFileSync(path.join(DATA, 'wilayas.json'), 'utf8')).wilayas;
const halls = JSON.parse(fs.readFileSync(path.join(DATA, 'halls.json'), 'utf8')).halls;
const wilayaByCode = new Map(wilayas.map((w) => [w.code, w]));
const hallById = new Map(halls.map((h) => [h.id, h]));

function syncHallToMemory(hall) {
  if (!hall || !hall.id) return;
  const idx = halls.findIndex((h) => h && h.id === hall.id);
  if (idx >= 0) halls[idx] = hall;
  else halls.push(hall);
  hallById.set(hall.id, hall);
}

function removeHallFromMemory(id) {
  const idx = halls.findIndex((h) => h && h.id === id);
  if (idx >= 0) halls.splice(idx, 1);
  hallById.delete(id);
}

async function refreshHallsFromStorage() {
  try {
    const all = await storage.getHalls();
    if (Array.isArray(all) && all.length) {
      halls.length = 0;
      hallById.clear();
      for (const h of all) {
        halls.push(h);
        hallById.set(h.id, h);
      }
    }
  } catch {
    /* keep in-memory fallback */
  }
}

// --- tiny helpers ------------------------------------------------------------

function send(res, status, body, type = 'application/json; charset=utf-8', extraHeaders = null) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const cacheControl = type.startsWith('application/json')
    ? 'no-store'
    : type.startsWith('text/html')
      ? 'no-cache'
      : 'public, max-age=300';
  const headers = {
    'Content-Type': type,
    'Content-Length': buf.length,
    'Cache-Control': cacheControl,
  };
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
  }
  res.writeHead(status, headers);
  res.end(buf);
}

function json(res, status, obj, extraHeaders = null) {
  send(res, status, JSON.stringify(obj), undefined, extraHeaders);
}

// --- auth context + guards -----------------------------------------------------

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

async function getAuthContext(req) {
  const cookies = auth.parseCookies(req.headers.cookie);
  const token = cookies[auth.SESSION_COOKIE];
  if (!token) return { session: null, user: null };
  const session = await storage.findSession(token);
  if (!session) return { session: null, user: null };
  const user = await storage.findUserById(session.userId);
  if (!user) return { session: null, user: null };
  return { session, user };
}

async function requireOwner(req, res, opts) {
  const ctx = await getAuthContext(req);
  if (!ctx.session || !ctx.user) {
    json(res, 401, { error: 'unauthorized', message: 'Owner login required' });
    return null;
  }
  if (ctx.user.role !== 'owner') {
    json(res, 403, { error: 'forbidden', message: 'Owner access required' });
    return null;
  }
  // Task 08: owner account-status enforcement.
  const status = ctx.user.status || 'approved';
  if (status === 'suspended') {
    json(res, 403, { error: 'account_suspended', message: 'Owner account suspended' });
    return null;
  }
  if (status === 'rejected') {
    json(res, 403, { error: 'account_rejected', message: 'Owner application rejected' });
    return null;
  }
  if (status === 'pending' && !(opts && opts.allowPending)) {
    json(res, 403, { error: 'owner_pending_approval', message: 'Owner account pending approval' });
    return null;
  }
  return ctx;
}

async function requireAdmin(req, res) {
  const ctx = await getAuthContext(req);
  if (!ctx.session || !ctx.user) {
    json(res, 401, { error: 'unauthorized', message: 'Admin login required' });
    return null;
  }
  if (ctx.user.role !== 'super_admin') {
    json(res, 403, { error: 'forbidden', message: 'Admin access required' });
    return null;
  }
  return ctx;
}

async function requireAuth(req, res) {
  const ctx = await getAuthContext(req);
  if (!ctx.session || !ctx.user) {
    json(res, 401, { error: 'unauthorized', message: 'Login required' });
    return null;
  }
  return ctx;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_JSON_BYTES) {
        reject(Object.assign(new Error('payload_too_large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('invalid_json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function validWilaya(code) {
  return typeof code === 'string' && /^\d{2}$/.test(code) && Number(code) >= 1 && Number(code) <= 69;
}

function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function pickLang(v) {
  return LANGS.includes(v) ? v : 'fr';
}

function t(obj, lang) {
  if (!obj || typeof obj !== 'object') return '';
  return obj[lang] || obj.fr || obj.ar || obj.en || '';
}

// --- Task 04: hall validation ---------------------------------------------------

function normalizeI18nField(v) {
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    return { fr: s, ar: s, en: s };
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const fr = typeof v.fr === 'string' ? v.fr.trim() : '';
    const ar = typeof v.ar === 'string' ? v.ar.trim() : '';
    const en = typeof v.en === 'string' ? v.en.trim() : '';
    if (!fr && !ar && !en) return null;
    return { fr: fr || ar || en, ar: ar || fr || en, en: en || fr || ar };
  }
  return null;
}

function validateHallCreate(body) {
  const name = normalizeI18nField(body.name);
  if (!name) return { error: 'invalid_name' };
  const wilaya = typeof body.wilaya === 'number' ? String(body.wilaya).padStart(2, '0') : body.wilaya;
  if (!validWilaya(wilaya)) return { error: 'invalid_wilaya' };
  const commune = typeof body.commune === 'string' ? body.commune.trim() : '';
  if (!commune || commune.length > 60) return { error: 'invalid_commune' };
  const capacityMin = toInt(body.capacityMin);
  const capacityMax = toInt(body.capacityMax);
  if (capacityMin == null || capacityMin < 1 || capacityMin > 5000) return { error: 'invalid_capacityMin' };
  if (capacityMax == null || capacityMax < 1 || capacityMax > 5000) return { error: 'invalid_capacityMax' };
  if (capacityMin > capacityMax) return { error: 'invalid_capacity' };
  const priceDzd = toInt(body.priceDzd);
  if (priceDzd == null) return { error: 'invalid_price' };
  if (!Array.isArray(body.styles) || !body.styles.length) return { error: 'invalid_styles' };
  for (const s of body.styles) {
    if (!STYLES.includes(s)) return { error: 'invalid_styles' };
  }
  if (!Array.isArray(body.amenities)) return { error: 'invalid_amenities' };
  for (const a of body.amenities) {
    if (typeof a !== 'string' || !a.trim()) return { error: 'invalid_amenities' };
  }
  const data = {
    name,
    wilaya,
    commune: commune.slice(0, 60),
    capacityMin,
    capacityMax,
    priceDzd,
    styles: [...body.styles],
    amenities: body.amenities.map((a) => a.trim()).slice(0, 20),
  };
  if (body.desc !== undefined) {
    const desc = normalizeI18nField(body.desc);
    if (!desc) return { error: 'invalid_desc' };
    data.desc = desc;
  } else {
    data.desc = { fr: '', ar: '', en: '' };
  }
  if (body.address !== undefined) {
    const address = normalizeI18nField(body.address);
    if (!address) return { error: 'invalid_address' };
    data.address = address;
  } else {
    data.address = { fr: data.commune, ar: data.commune, en: data.commune };
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || !body.phone.trim() || body.phone.length > 32) {
      return { error: 'invalid_phone' };
    }
    data.phone = body.phone.trim();
  } else {
    data.phone = '';
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos) || body.photos.some((p) => typeof p !== 'string')) {
      return { error: 'invalid_photos' };
    }
    data.photos = body.photos.slice(0, 30);
  } else {
    data.photos = [];
  }
  if (body.tourScenes !== undefined) {
    if (!Array.isArray(body.tourScenes)) return { error: 'invalid_tourScenes' };
    data.tourScenes = body.tourScenes;
  }
  if (body.rating !== undefined) {
    const r = Number(body.rating);
    if (!Number.isFinite(r) || r < 0 || r > 5) return { error: 'invalid_rating' };
    data.rating = r;
  } else {
    data.rating = 4.5;
  }
  if (body.reviews !== undefined) {
    const rv = toInt(body.reviews);
    if (rv == null) return { error: 'invalid_reviews' };
    data.reviews = rv;
  } else {
    data.reviews = 0;
  }
  return { data };
}

function validateHallUpdate(body) {
  const updates = {};
  if (body.name !== undefined) {
    const name = normalizeI18nField(body.name);
    if (!name) return { error: 'invalid_name' };
    updates.name = name;
  }
  if (body.wilaya !== undefined) {
    const wilaya = typeof body.wilaya === 'number' ? String(body.wilaya).padStart(2, '0') : body.wilaya;
    if (!validWilaya(wilaya)) return { error: 'invalid_wilaya' };
    updates.wilaya = wilaya;
  }
  if (body.commune !== undefined) {
    const commune = typeof body.commune === 'string' ? body.commune.trim() : '';
    if (!commune || commune.length > 60) return { error: 'invalid_commune' };
    updates.commune = commune.slice(0, 60);
  }
  if (body.capacityMin !== undefined) {
    const v = toInt(body.capacityMin);
    if (v == null || v < 1 || v > 5000) return { error: 'invalid_capacityMin' };
    updates.capacityMin = v;
  }
  if (body.capacityMax !== undefined) {
    const v = toInt(body.capacityMax);
    if (v == null || v < 1 || v > 5000) return { error: 'invalid_capacityMax' };
    updates.capacityMax = v;
  }
  if (body.priceDzd !== undefined) {
    const v = toInt(body.priceDzd);
    if (v == null) return { error: 'invalid_price' };
    updates.priceDzd = v;
  }
  if (body.styles !== undefined) {
    if (!Array.isArray(body.styles) || !body.styles.length) return { error: 'invalid_styles' };
    for (const s of body.styles) {
      if (!STYLES.includes(s)) return { error: 'invalid_styles' };
    }
    updates.styles = [...body.styles];
  }
  if (body.amenities !== undefined) {
    if (!Array.isArray(body.amenities)) return { error: 'invalid_amenities' };
    for (const a of body.amenities) {
      if (typeof a !== 'string' || !a.trim()) return { error: 'invalid_amenities' };
    }
    updates.amenities = body.amenities.map((a) => a.trim()).slice(0, 20);
  }
  if (body.desc !== undefined) {
    const desc = normalizeI18nField(body.desc);
    if (!desc) return { error: 'invalid_desc' };
    updates.desc = desc;
  }
  if (body.address !== undefined) {
    const address = normalizeI18nField(body.address);
    if (!address) return { error: 'invalid_address' };
    updates.address = address;
  }
  if (body.phone !== undefined) {
    if (typeof body.phone !== 'string' || body.phone.length > 32) return { error: 'invalid_phone' };
    updates.phone = body.phone.trim();
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos) || body.photos.some((p) => typeof p !== 'string')) {
      return { error: 'invalid_photos' };
    }
    updates.photos = body.photos.slice(0, 30);
  }
  if (body.tourScenes !== undefined) {
    if (!Array.isArray(body.tourScenes)) return { error: 'invalid_tourScenes' };
    updates.tourScenes = body.tourScenes;
  }
  if (body.rating !== undefined) {
    const r = Number(body.rating);
    if (!Number.isFinite(r) || r < 0 || r > 5) return { error: 'invalid_rating' };
    updates.rating = r;
  }
  if (body.reviews !== undefined) {
    const rv = toInt(body.reviews);
    if (rv == null) return { error: 'invalid_reviews' };
    updates.reviews = rv;
  }
  if (updates.capacityMin != null && updates.capacityMax != null && updates.capacityMin > updates.capacityMax) {
    return { error: 'invalid_capacity' };
  }
  return { updates };
}

// --- search + deterministic cached ranking -----------------------------------

async function filterHalls(q) {
  // Task 04: keep public search in sync with owner CRUD (storage is source of truth).
  await refreshHallsFromStorage();
  // Date-aware availability: a hall with a confirmed booking on q.date is
  // excluded. Pending inquiries never block availability — only an
  // accepted/confirmed inquiry does. Rejected inquiries never block either.
  let bookedOnDate = null;
  if (q.date) {
    bookedOnDate = new Set(
      (await storage.loadInquiries())
        .filter((i) => i.status === 'confirmed' && i.date === q.date)
        .map((i) => i.hallId)
    );
  }
  const matched = halls.filter((h) => {
    if (q.wilaya && h.wilaya !== q.wilaya) return false;
    if (q.commune && !h.commune.toLowerCase().includes(String(q.commune).toLowerCase())) return false;
    if (q.guests != null && !(q.guests >= h.capacityMin * 0.5 && q.guests <= h.capacityMax * 1.1)) return false;
    if (q.budget != null && !(h.priceDzd <= q.budget * 1.25)) return false;
    if (q.style && !h.styles.includes(q.style)) return false;
    if (Array.isArray(q.amenities) && q.amenities.length && !q.amenities.every((a) => h.amenities.includes(a))) return false;
    if (bookedOnDate && bookedOnDate.has(h.id)) return false;
    return true;
  });
  // Task 08: public discovery only shows seed demo halls (no ownerId) and
  // halls owned by approved owners. Pending/suspended/rejected owners'
  // halls are hidden. Unknown owners are treated as approved (legacy data).
  const ownerIds = [...new Set(matched.map((h) => h.ownerId).filter(Boolean))];
  if (!ownerIds.length) return matched;
  const visible = new Set();
  await Promise.all(ownerIds.map(async (ownerId) => {
    try {
      const u = await storage.findUserById(ownerId);
      if (!u || (u.status || 'approved') === 'approved') visible.add(ownerId);
    } catch {
      visible.add(ownerId);
    }
  }));
  return matched.filter((h) => !h.ownerId || visible.has(h.ownerId));
}

// --- natural-language discovery prompt parsing (deterministic) -----------------

function normLatin(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function latinIndex(nPrompt, alias) {
  const n = normLatin(alias);
  if (!n) return -1;
  const m = new RegExp(`(^|[^a-z0-9])${escapeRegExp(n)}([^a-z0-9]|$)`).exec(nPrompt);
  if (!m) return -1;
  return m.index + m[1].length;
}

const WILAYA_ALIASES = {
  '16': ['algiers', 'alger', 'الجزائر'],
  '31': ['oran', 'وهران'],
  '25': ['constantine', 'قسنطينة'],
  '09': ['blida', 'البليدة'],
  '19': ['setif', 'sétif', 'سطيف'],
  '23': ['annaba', 'عنابة'],
  '15': ['tizi ouzou', 'tizi-ouzou', 'تيزي وزو'],
  '06': ['bejaia', 'béjaïa', 'بجاية'],
  '13': ['tlemcen', 'تلمسان'],
  '30': ['ouargla', 'ورقلة'],
  '69': ['messaad', 'مسعد'],
};

const MONTHS = [
  { m: 1, latin: ['january', 'janvier', 'jan'], arabic: ['جانفي', 'يناير'] },
  { m: 2, latin: ['february', 'fevrier', 'février', 'feb'], arabic: ['فيفري', 'فبراير', 'شباط'] },
  { m: 3, latin: ['march', 'mars', 'mar'], arabic: ['مارس', 'آذار', 'اذار'] },
  { m: 4, latin: ['april', 'avril', 'apr'], arabic: ['أفريل', 'افريل', 'أبريل', 'ابريل', 'نيسان'] },
  { m: 5, latin: ['may', 'mai'], arabic: ['ماي', 'مايو', 'أيار', 'ايار'] },
  { m: 6, latin: ['june', 'juin', 'jun'], arabic: ['جوان', 'يونيو', 'حزيران'] },
  { m: 7, latin: ['july', 'juillet', 'jul'], arabic: ['جويلية', 'يوليو', 'تموز'] },
  { m: 8, latin: ['august', 'aout', 'août', 'aug'], arabic: ['أوت', 'اوت', 'أغسطس', 'اغسطس', 'آب', 'اب'] },
  { m: 9, latin: ['september', 'septembre', 'sept', 'sep'], arabic: ['سبتمبر', 'أيلول', 'ايلول'] },
  { m: 10, latin: ['october', 'octobre', 'oct'], arabic: ['أكتوبر', 'اكتوبر', 'تشرين الأول', 'تشرين الاول'] },
  { m: 11, latin: ['november', 'novembre', 'nov'], arabic: ['نوفمبر', 'تشرين الثاني'] },
  { m: 12, latin: ['december', 'decembre', 'décembre', 'dec'], arabic: ['ديسمبر', 'كانون الأول', 'كانون الاول'] },
];

const STYLE_KEYWORDS = {
  moderne: { latin: ['moderne', 'modern', 'contemporary', 'contemporain'], arabic: ['عصري', 'حديث'] },
  traditionnel: { latin: ['traditionnel', 'traditional', 'kabyle', 'chaabi'], arabic: ['تقليدي', 'قبائلي', 'أصيل', 'اصيل'] },
  oriental: { latin: ['oriental', 'andalou', 'andalusian', 'moorish', 'palace'], arabic: ['شرقي', 'أندلسي', 'اندلسي'] },
  minimaliste: { latin: ['minimaliste', 'minimal', 'minimalist', 'simple', 'epure', 'épuré'], arabic: ['بسيط'] },
  exterieur: { latin: ['exterieur', 'extérieur', 'outdoor', 'garden', 'jardin'], arabic: ['خارجي', 'حديقة'] },
};

const AMENITY_KEYWORDS = {
  parking: { latin: ['car park', 'parking', 'stationnement'], arabic: ['موقف'] },
  cuisine: { latin: ['catering', 'traiteur', 'cuisine', 'kitchen', 'food'], arabic: ['مطبخ', 'إطعام', 'اطعام'] },
  clim: { latin: ['air conditioning', 'climatisation', 'clim', 'ac'], arabic: ['تكييف', 'مكيفة'] },
  sono: { latin: ['sonorisation', 'sound', 'sono', 'audio', 'dj'], arabic: ['صوتيات'] },
  deco: { latin: ['decoration', 'décoration', 'decor', 'décor'], arabic: ['ديكور', 'زينة'] },
  vestiaire: { latin: ['changing room', 'cloakroom', 'vestiaire'], arabic: ['حجرة ملابس'] },
  jardin: { latin: ['garden', 'jardin', 'lawn'], arabic: ['حديقة'] },
  hebergement: { latin: ['accommodation', 'hebergement', 'hébergement', 'lodging', 'hotel'], arabic: ['إقامة', 'اقامة'] },
};

function parseDiscoveryPrompt(prompt) {
  const out = {};
  if (typeof prompt !== 'string' || !prompt.trim()) return out;
  const text = prompt.slice(0, 1000);
  const nPrompt = normLatin(text);

  // wilaya: official names + aliases, earliest mention wins
  let bestWilaya = null;
  let bestWilayaIdx = -1;
  const considerWilaya = (code, idx) => {
    if (idx < 0) return;
    if (bestWilayaIdx < 0 || idx < bestWilayaIdx) {
      bestWilaya = code;
      bestWilayaIdx = idx;
    }
  };
  for (const w of wilayas) {
    for (const name of [w.fr, w.en]) {
      if (name) considerWilaya(w.code, latinIndex(nPrompt, name));
    }
    if (w.ar && text.includes(w.ar)) considerWilaya(w.code, text.indexOf(w.ar));
  }
  for (const [code, aliases] of Object.entries(WILAYA_ALIASES)) {
    for (const a of aliases) {
      if (/[\u0600-\u06FF]/.test(a)) {
        if (text.includes(a)) considerWilaya(code, text.indexOf(a));
      } else {
        considerWilaya(code, latinIndex(nPrompt, a));
      }
    }
  }
  if (bestWilaya) out.wilaya = bestWilaya;

  // commune: any commune in halls.json, earliest wins
  const seenCommunes = new Map();
  for (const h of halls) {
    if (!seenCommunes.has(h.commune.toLowerCase())) seenCommunes.set(h.commune.toLowerCase(), h.commune);
  }
  let bestCommune = null;
  let bestCommuneIdx = -1;
  for (const commune of seenCommunes.values()) {
    const idx = latinIndex(nPrompt, commune);
    if (idx >= 0 && (bestCommuneIdx < 0 || idx < bestCommuneIdx)) {
      bestCommune = commune;
      bestCommuneIdx = idx;
    }
  }
  if (bestCommune) out.commune = bestCommune;

  // date: explicit YYYY-MM-DD
  const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/g);
  if (dateMatch) {
    for (const d of dateMatch) {
      if (validDate(d)) {
        out.date = d;
        break;
      }
    }
  }

  // month: EN/FR/AR names, earliest wins
  let bestMonth = null;
  let bestMonthIdx = -1;
  for (const entry of MONTHS) {
    for (const kw of entry.latin) {
      const idx = latinIndex(nPrompt, kw);
      if (idx >= 0 && (bestMonthIdx < 0 || idx < bestMonthIdx)) {
        bestMonth = entry.m;
        bestMonthIdx = idx;
      }
    }
    for (const kw of entry.arabic) {
      const idx = text.indexOf(kw);
      if (idx >= 0 && (bestMonthIdx < 0 || idx < bestMonthIdx)) {
        bestMonth = entry.m;
        bestMonthIdx = idx;
      }
    }
  }
  if (bestMonth != null) out.month = bestMonth;

  // guests: explicit guest keywords first, then for/pour fallback
  const parseNum = (s) => {
    const cleaned = String(s).replace(/[\s,]/g, '');
    if (!/^\d+$/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isSafeInteger(n) ? n : null;
  };
  const textNoDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  let guests = null;
  const guestRe = /(\d[\d\s,]*)\s*(guests?|invites?|personnes?|convives?|pax)/i;
  const gm = normLatin(textNoDates).match(guestRe);
  if (gm) {
    const n = parseNum(gm[1]);
    if (n != null && n >= 1 && n <= 5000) guests = n;
  }
  if (guests == null) {
    const arGuestRe = /(\d[\d\s,]*)\s*(ضيوف|ضيف|شخص|أشخاص|اشخاص)/;
    const am = textNoDates.match(arGuestRe);
    if (am) {
      const n = parseNum(am[1]);
      if (n != null && n >= 1 && n <= 5000) guests = n;
    }
  }
  if (guests == null) {
    const forRe = /\b(?:for|pour)\s+(\d[\d\s,]*)/gi;
    const nText = normLatin(textNoDates);
    let m;
    while ((m = forRe.exec(nText)) !== null) {
      const after = nText.slice(m.index + m[0].length, m.index + m[0].length + 12);
      if (/\b(dzd|da|dinars?|budget)\b/.test(after) || /دج/.test(textNoDates.slice(m.index, m.index + 30))) continue;
      const n = parseNum(m[1]);
      if (n != null && n >= 1 && n <= 5000) {
        guests = n;
        break;
      }
    }
  }
  if (guests != null) out.guests = guests;

  // budget: currency, budget keyword, or k-suffix (>=1000)
  let budget = null;
  const budgetKRe = /(\d[\d\s,]*)\s*k\s*(d\s*z\s*d|da|dzd|dinars?|dinar|دج)?/i;
  const km = textNoDates.match(budgetKRe);
  if (km && !/guests?|invites?|personnes?|ضيف|شخص/i.test(textNoDates.slice(Math.max(0, km.index - 2), km.index + km[0].length + 12))) {
    const base = parseNum(km[1]);
    if (base != null) {
      const val = base * 1000;
      if (val >= 1000 && Number.isSafeInteger(val)) budget = val;
    }
  }
  if (budget == null) {
    const curRe = /(\d[\d\s,]*)\s*(dzd|da\b|دج|dinars?|dinar)/i;
    const cm = textNoDates.match(curRe);
    if (cm) {
      const n = parseNum(cm[1]);
      if (n != null && n >= 1000) budget = n;
    }
  }
  if (budget == null) {
    const bRe = /budget\s*(?:of|de|du|pour|:)?\s*(\d[\d\s,]*)\s*(k)?/i;
    const bm = textNoDates.match(bRe);
    if (bm) {
      const n = parseNum(bm[1]);
      if (n != null) {
        const val = bm[2] ? n * 1000 : n;
        if (val >= 1000 && Number.isSafeInteger(val)) budget = val;
      }
    }
  }
  if (budget != null) out.budget = budget;

  // style: explicit keywords only (elegant must not match)
  let bestStyle = null;
  let bestStyleIdx = -1;
  for (const [style, kws] of Object.entries(STYLE_KEYWORDS)) {
    for (const kw of kws.latin) {
      const idx = latinIndex(nPrompt, kw);
      if (idx >= 0 && (bestStyleIdx < 0 || idx < bestStyleIdx)) {
        bestStyle = style;
        bestStyleIdx = idx;
      }
    }
    for (const kw of kws.arabic) {
      const idx = text.indexOf(kw);
      if (idx >= 0 && (bestStyleIdx < 0 || idx < bestStyleIdx)) {
        bestStyle = style;
        bestStyleIdx = idx;
      }
    }
  }
  if (bestStyle) out.style = bestStyle;

  // amenities
  const found = [];
  for (const [key, kws] of Object.entries(AMENITY_KEYWORDS)) {
    let idx = -1;
    for (const kw of kws.latin) {
      const i = latinIndex(nPrompt, kw);
      if (i >= 0 && (idx < 0 || i < idx)) idx = i;
    }
    for (const kw of kws.arabic) {
      const i = text.indexOf(kw);
      if (i >= 0 && (idx < 0 || i < idx)) idx = i;
    }
    if (idx >= 0) found.push({ key, idx });
  }
  if (found.length) {
    found.sort((a, b) => a.idx - b.idx);
    out.amenities = found.map((f) => f.key);
  }

  return out;
}

function scoreHall(h, q) {
  let score = 0;
  const why = [];
  if (q.wilaya) {
    if (h.wilaya === q.wilaya) {
      score += 40;
      why.push('wilaya_exact');
    }
  } else {
    score += 10;
  }
  if (q.guests != null) {
    if (q.guests >= h.capacityMin && q.guests <= h.capacityMax) {
      score += 25;
      why.push('capacity_fit');
    } else if (q.guests <= h.capacityMax * 1.1) {
      score += 12;
      why.push('capacity_close');
    }
  } else {
    score += 8;
  }
  if (q.budget != null) {
    if (h.priceDzd <= q.budget) {
      score += 20;
      why.push('budget_fit');
    } else if (h.priceDzd <= q.budget * 1.25) {
      score += 8;
      why.push('budget_close');
    }
  } else {
    score += 8;
  }
  if (q.style) {
    if (h.styles.includes(q.style)) {
      score += 10;
      why.push('style_fit');
    }
  } else {
    score += 4;
  }
  if (Array.isArray(q.amenities) && q.amenities.length) {
    const matched = q.amenities.filter((a) => h.amenities.includes(a));
    if (matched.length === q.amenities.length) {
      score += 10;
      why.push('amenities_fit');
    } else if (matched.length > 0) {
      score += Math.round((matched.length / q.amenities.length) * 10);
      why.push('amenities_fit');
    }
  }
  score += Math.round((h.rating / 5) * 5);
  return { score: Math.min(100, score), why };
}

const WHY_TEXT = {
  wilaya_exact: { fr: 'dans la wilaya demandée', ar: 'في الولاية المطلوبة', en: 'in the requested wilaya' },
  capacity_fit: { fr: 'capacité adaptée au nombre d’invités', ar: 'سعة مناسبة لعدد الضيوف', en: 'capacity fits your guest count' },
  capacity_close: { fr: 'capacité proche de votre besoin', ar: 'سعة قريبة من احتياجكم', en: 'capacity close to your needs' },
  budget_fit: { fr: 'tarif dans votre budget', ar: 'السعر ضمن ميزانيتكم', en: 'price within your budget' },
  budget_close: { fr: 'tarif légèrement au-dessus du budget', ar: 'السعر أعلى قليلاً من الميزانية', en: 'price slightly above budget' },
  style_fit: { fr: 'style correspondant à vos goûts', ar: 'طراز يطابق ذوقكم', en: 'style matches your taste' },
  amenities_fit: { fr: 'équipements demandés disponibles', ar: 'المرافق المطلوبة متوفرة', en: 'requested amenities available' },
};

async function cachedRanking(q, lang) {
  const list = await filterHalls(q);
  return list
    .map((h) => {
      const s = scoreHall(h, q);
      const bits = s.why.map((k) => t(WHY_TEXT[k], lang));
      const wName = wilayaByCode.get(h.wilaya);
      const wLabel = wName ? (wName[lang] || wName.fr) : h.wilaya;
      const matchedAmenities = Array.isArray(q.amenities) ? q.amenities.filter((a) => h.amenities.includes(a)) : [];
      const matchedStyle = q.style && h.styles.includes(q.style) ? q.style : null;
      const extras = [];
      if (matchedAmenities.length) extras.push(matchedAmenities.join(', '));
      if (matchedStyle) extras.push(matchedStyle);
      const extraBits = extras.length
        ? lang === 'ar'
          ? ` يطابق: ${extras.join('، ')}`
          : lang === 'en'
            ? ` matches: ${extras.join(', ')}`
            : ` correspond à : ${extras.join(', ')}`
        : '';
      const facts =
        lang === 'ar'
          ? `${h.capacityMin}–${h.capacityMax} ضيف، ${h.priceDzd} دج، ${h.commune} (${h.wilaya} — ${wLabel})`
          : lang === 'en'
            ? `${h.capacityMin}-${h.capacityMax} guests, ${h.priceDzd} DZD, ${h.commune} (${h.wilaya} — ${wLabel})`
            : `${h.capacityMin}–${h.capacityMax} invités, ${h.priceDzd} DA, ${h.commune} (${h.wilaya} — ${wLabel})`;
      const reason =
        lang === 'ar'
          ? `موصى به: ${facts}.${extraBits} ${bits.join('، ') || 'خيار متوازن'}.`
          : lang === 'en'
            ? `Recommended: ${facts}.${extraBits} ${bits.join(', ') || 'a balanced choice'}.`
            : `Recommandé : ${facts}.${extraBits} ${bits.join(', ') || 'un choix équilibré'}.`;
      return { id: h.id, score: s.score, reason };
    })
    .sort((a, b) => b.score - a.score);
}

// --- cached segmentation (honest demo fallback) -------------------------------

const SEG_LABELS = {
  stage: { fr: 'Scène / estrade', ar: 'المسرح / المنصة', en: 'Stage' },
  tables: { fr: 'Tables', ar: 'الطاولات', en: 'Tables' },
  chairs: { fr: 'Chaises', ar: 'الكراسي', en: 'Chairs' },
  decor: { fr: 'Décorations', ar: 'الزينة', en: 'Decorations' },
  entrance: { fr: 'Entrée / allée', ar: 'المدخل / الممر', en: 'Entrance / aisle' },
};

function cachedSegmentation() {
  // Deterministic, clearly-labelled demo regions in normalized 0..1 boxes.
  return [
    { key: 'stage', box: { x: 0.3, y: 0.04, w: 0.4, h: 0.22 }, confidence: 0.62 },
    { key: 'decor', box: { x: 0.24, y: 0.02, w: 0.52, h: 0.3 }, confidence: 0.55 },
    { key: 'tables', box: { x: 0.06, y: 0.4, w: 0.38, h: 0.3 }, confidence: 0.6 },
    { key: 'tables', box: { x: 0.56, y: 0.4, w: 0.38, h: 0.3 }, confidence: 0.6 },
    { key: 'chairs', box: { x: 0.1, y: 0.72, w: 0.8, h: 0.24 }, confidence: 0.58 },
    { key: 'entrance', box: { x: 0.44, y: 0.4, w: 0.12, h: 0.56 }, confidence: 0.5 },
  ];
}

// --- cached decoration concepts + SVG concept art -----------------------------

const PALETTES = {
  gold: ['#8a6d1c', '#c9a227', '#f3e5b8', '#2f4f3e'],
  rose: ['#7a2e3f', '#c96a7b', '#f6dfe3', '#3e3a34'],
  emerald: ['#0d5c46', '#3d9a7c', '#dcefe5', '#8a6d1c'],
  blue: ['#1f3a5f', '#4a7fb5', '#d8e7f4', '#b08d2e'],
};

const CONCEPTS = {
  moderne: {
    title: { fr: 'Élégance contemporaine', ar: 'أناقة عصرية', en: 'Contemporary elegance' },
    desc: {
      fr: 'Lignes épurées, arche lumineuse, nappes ivoire et centres de table bas avec orchidées blanches.',
      ar: 'خطوط أنيقة، قوس مضيء، مفارش عاجية وتنسيقات أوركيد بيضاء منخفضة.',
      en: 'Clean lines, a light arch, ivory linens and low white-orchid centrepieces.',
    },
    tips: {
      fr: ['Éclairage blanc chaud 3000K', 'Allée centrale dégagée pour le cortège', 'Photobooth près de l’entrée'],
      ar: ['إضاءة بيضاء دافئة 3000K', 'ممر مركزي واضح للموكب', 'ركن تصوير قرب المدخل'],
      en: ['Warm-white 3000K lighting', 'Clear central aisle for the procession', 'Photo corner near the entrance'],
    },
  },
  traditionnel: {
    title: { fr: 'Fête algéroise traditionnelle', ar: 'عرس جزائري تقليدي', en: 'Traditional Algerian celebration' },
    desc: {
      fr: 'Tapis berbères, lanternes en cuivre, coussins brodés et estrade drapée de tissus aux motifs régionaux.',
      ar: 'زرابي بربرية، فوانيس نحاسية، وسائد مطرزة ومنصة مكسوة بأقمشة بنقوش محلية.',
      en: 'Berber rugs, copper lanterns, embroidered cushions and a stage draped in regional fabrics.',
    },
    tips: {
      fr: ['Ambiance musicale chaâbi ou kabyle', 'Espace henna près de la scène', 'Tables rondes familiales'],
      ar: ['أجواء موسيقية شعبية أو قبائلية', 'ركن الحناء قرب المسرح', 'طاولات مستديرة عائلية'],
      en: ['Chaabi or Kabyle music', 'Henna corner near the stage', 'Round family tables'],
    },
  },
  oriental: {
    title: { fr: 'Nuits d’Orient', ar: 'ليالي الشرق', en: 'Oriental nights' },
    desc: {
      fr: 'Arches mauresques, dorures, voilages bordeaux et chandeliers pour une ambiance de palais.',
      ar: 'أقواس مغاربية، تذهيب، ستائر عنابية وثريات لأجواء القصور.',
      en: 'Moorish arches, gilding, burgundy drapes and chandeliers for a palace mood.',
    },
    tips: {
      fr: ['Bougies LED sécurisées', 'Scène surélevée pour la vue', 'Coin salon marocain'],
      ar: ['شموع LED آمنة', 'منصة مرتفعة للرؤية', 'ركن صالون مغربي'],
      en: ['Safe LED candles', 'Raised stage for sightlines', 'Moroccan lounge corner'],
    },
  },
  minimaliste: {
    title: { fr: 'Minimalisme lumineux', ar: 'بساطة مضيئة', en: 'Luminous minimalism' },
    desc: {
      fr: 'Blanc cassé et verdure, guirlandes fines, tables nues en bois clair et lumière naturelle maximale.',
      ar: 'أبيض مائل للعاجي مع خضرة، أسلاك إضاءة رفيعة، طاولات خشبية فاتحة وأقصى إضاءة طبيعية.',
      en: 'Off-white and greenery, fine string lights, bare light-wood tables and maximum daylight.',
    },
    tips: {
      fr: ['Cérémonie en journée', 'Fleurs de saison locales', 'Plan de table épuré'],
      ar: ['حفل نهاري', 'زهور موسمية محلية', 'مخطط طاولات مبسط'],
      en: ['Daytime ceremony', 'Local seasonal flowers', 'Simple seating plan'],
    },
  },
  exterieur: {
    title: { fr: 'Jardin de fête', ar: 'حديقة الفرح', en: 'Party garden' },
    desc: {
      fr: 'Tonnelles fleuries, lampions suspendus, mange-debout et piste de danse sous les étoiles.',
      ar: 'عرائش مزهرة، فوانيس معلقة، طاولات عالية وحلبة رقص تحت النجوم.',
      en: 'Flower arches, hanging lanterns, cocktail tables and dancing under the stars.',
    },
    tips: {
      fr: ['Plan B chapiteau en cas de vent', 'Éclairage solaire d’allées', 'Vestiaire pour la soirée'],
      ar: ['خطة بديلة بخيمة عند الرياح', 'إضاءة شمسية للممرات', 'حجرة ملابس للسهرة'],
      en: ['Marquee backup plan for wind', 'Solar path lighting', 'Cloakroom for the evening'],
    },
  },
};

function svgConceptArt(style, paletteName, title) {
  const p = PALETTES[paletteName] || PALETTES.gold;
  const esc = String(title).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">` +
    `<rect width="640" height="400" fill="${p[2]}"/>` +
    `<rect x="0" y="0" width="640" height="70" fill="${p[0]}"/>` +
    `<text x="32" y="44" font-family="Georgia,serif" font-size="26" fill="#ffffff">${esc}</text>` +
    `<ellipse cx="320" cy="150" rx="120" ry="60" fill="none" stroke="${p[1]}" stroke-width="8"/>` +
    `<line x1="200" y1="150" x2="200" y2="250" stroke="${p[1]}" stroke-width="8"/>` +
    `<line x1="440" y1="150" x2="440" y2="250" stroke="${p[1]}" stroke-width="8"/>` +
    `<rect x="150" y="250" width="340" height="18" rx="4" fill="${p[0]}"/>` +
    `<rect x="90" y="300" width="120" height="14" rx="7" fill="${p[1]}"/>` +
    `<rect x="260" y="300" width="120" height="14" rx="7" fill="${p[3]}"/>` +
    `<rect x="430" y="300" width="120" height="14" rx="7" fill="${p[1]}"/>` +
    `<circle cx="130" cy="286" r="10" fill="${p[3]}"/><circle cx="320" cy="286" r="10" fill="${p[1]}"/><circle cx="490" cy="286" r="10" fill="${p[3]}"/>` +
    `<circle cx="90" cy="120" r="7" fill="${p[1]}"/><circle cx="550" cy="120" r="7" fill="${p[1]}"/>` +
    `<circle cx="140" cy="100" r="5" fill="${p[3]}"/><circle cx="500" cy="100" r="5" fill="${p[3]}"/>` +
    `<text x="32" y="372" font-family="Georgia,serif" font-size="15" fill="${p[0]}">${style} · ${paletteName}</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// --- inquiries: pending until the hall owner accepts/confirms -----------------
// A request starts as pending (en attente) and does not block availability
// until the hall owner accepts/confirms it (confirmée par la salle).

function newReference(existing) {
  const refs = new Set(existing.map((i) => i.reference));
  for (;;) {
    const ref = `WAL-${crypto.randomBytes(4).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X').slice(0, 6).padEnd(6, '7')}`;
    if (!refs.has(ref)) return ref;
  }
}

const INQUIRY_STATUSES = ['pending', 'confirmed', 'rejected'];

// Public lookup shape: enough to track a booking, no client contact details.
function publicInquiry(i) {
  return {
    reference: i.reference,
    status: i.status,
    hallId: i.hallId,
    hallName: i.hallName,
    wilaya: i.wilaya,
    date: i.date,
    guests: i.guests,
    message: i.message || '',
    ownerNote: i.ownerNote || '',
    lang: i.lang,
    createdAt: i.createdAt,
    decidedAt: i.decidedAt || null,
  };
}

// --- static files --------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'forbidden' });
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) {
      const ext = path.extname(file).toLowerCase();
      fs.readFile(file, (rerr, data) => {
        if (rerr) return json(res, 500, { error: 'read_failed' });
        send(res, 200, data, MIME[ext] || 'application/octet-stream');
      });
      return;
    }
    if (!pathname.startsWith('/api/')) {
      fs.readFile(path.join(PUBLIC, 'index.html'), (rerr, data) => {
        if (rerr) return json(res, 500, { error: 'no_index' });
        send(res, 200, data, MIME['.html']);
      });
      return;
    }
    json(res, 404, { error: 'not_found' });
  });
}

// --- routes --------------------------------------------------------------------

async function handleApi(req, res, pathname, url) {
  const method = req.method;

  if (method === 'GET' && pathname === '/api/health') {
    return json(res, 200, { ok: true, time: new Date().toISOString(), halls: halls.length, wilayas: wilayas.length });
  }

  if (method === 'GET' && pathname === '/api/meta-status') {
    return json(res, 200, {
      base: meta.META_BASE,
      models: meta.MODELS,
      keyConfigured: meta.isConfigured(),
      note: meta.isConfigured()
        ? 'Meta Model API key is configured server-side; live calls will be attempted with cached fallback.'
        : 'No Meta API key configured; all AI features run in cached demo mode.',
    });
  }

  if (method === 'GET' && pathname === '/api/wilayas') {
    return json(res, 200, { wilayas });
  }

  if (method === 'GET' && pathname === '/api/halls/search') {
    const q = {};
    const wilaya = url.searchParams.get('wilaya') || '';
    if (wilaya) {
      if (!validWilaya(wilaya)) return json(res, 400, { error: 'invalid_wilaya' });
      q.wilaya = wilaya;
    }
    const commune = (url.searchParams.get('commune') || '').trim().slice(0, 60);
    if (commune) q.commune = commune;
    const date = url.searchParams.get('date') || '';
    if (date) {
      if (!validDate(date)) return json(res, 400, { error: 'invalid_date' });
      q.date = date;
    }
    const guestsRaw = url.searchParams.get('guests') || '';
    if (guestsRaw) {
      const g = toInt(guestsRaw);
      if (g == null || g < 1 || g > 5000) return json(res, 400, { error: 'invalid_guests' });
      q.guests = g;
    }
    const budgetRaw = url.searchParams.get('budget') || '';
    if (budgetRaw) {
      const b = toInt(budgetRaw);
      if (b == null || b < 1000) return json(res, 400, { error: 'invalid_budget' });
      q.budget = b;
    }
    const style = url.searchParams.get('style') || '';
    if (style) {
      if (!STYLES.includes(style)) return json(res, 400, { error: 'invalid_style' });
      q.style = style;
    }
    const amenitiesRaw = url.searchParams.get('amenities') || '';
    if (amenitiesRaw) {
      const amenities = amenitiesRaw.split(',').map((a) => a.trim()).filter((a) => a.length > 0);
      if (amenities.length) q.amenities = amenities;
    }
    const list = (await filterHalls(q)).map((h) => ({
      ...h,
      wilayaName: wilayaByCode.get(h.wilaya) || null,
    }));
    return json(res, 200, { criteria: q, count: list.length, halls: list });
  }

  if (method === 'GET' && pathname.startsWith('/api/halls/')) {
    const id = decodeURIComponent(pathname.slice('/api/halls/'.length));
    let h = hallById.get(id);
    if (!h) {
      try {
        h = await storage.getHallById(id);
        if (h) syncHallToMemory(h);
      } catch {
        h = null;
      }
    }
    if (!h) return json(res, 404, { error: 'hall_not_found' });
    return json(res, 200, { hall: { ...h, wilayaName: wilayaByCode.get(h.wilaya) || null } });
  }

  if (method === 'POST' && (pathname === '/api/ai/rank' || pathname === '/api/ai/discover')) {
    const body = await readJson(req);
    const lang = pickLang(body.lang);
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 1000) : '';
    const parsed = prompt ? parseDiscoveryPrompt(prompt) : {};
    const explicit = body.criteria && typeof body.criteria === 'object' ? body.criteria : {};
    const q = { ...parsed };
    if (explicit.wilaya !== undefined && explicit.wilaya !== null && explicit.wilaya !== '') {
      q.wilaya = typeof explicit.wilaya === 'number' ? String(explicit.wilaya).padStart(2, '0') : String(explicit.wilaya);
    }
    if (explicit.commune !== undefined && explicit.commune !== null && explicit.commune !== '') {
      q.commune = String(explicit.commune).trim().slice(0, 60);
      if (!q.commune) delete q.commune;
    }
    if (explicit.date !== undefined && explicit.date !== null && explicit.date !== '') {
      q.date = String(explicit.date);
    }
    if (explicit.month !== undefined && explicit.month !== null && explicit.month !== '') {
      const m = Number(explicit.month);
      if (Number.isInteger(m) && m >= 1 && m <= 12) q.month = m;
      else delete q.month;
    }
    if (explicit.guests !== undefined && explicit.guests !== null && explicit.guests !== '') {
      q.guests = explicit.guests;
    }
    if (explicit.budget !== undefined && explicit.budget !== null && explicit.budget !== '') {
      q.budget = explicit.budget;
    }
    if (explicit.style !== undefined && explicit.style !== null && explicit.style !== '') {
      q.style = String(explicit.style);
    }
    if (Array.isArray(explicit.amenities)) {
      q.amenities = explicit.amenities.filter((a) => typeof a === 'string' && a).slice(0, 20);
      if (!q.amenities.length) delete q.amenities;
    }
    if (q.wilaya && !validWilaya(q.wilaya)) return json(res, 400, { error: 'invalid_wilaya' });
    if (q.style && !STYLES.includes(q.style)) return json(res, 400, { error: 'invalid_style' });
    if (q.date && !validDate(q.date)) return json(res, 400, { error: 'invalid_date' });
    if (q.guests != null) {
      const g = toInt(q.guests);
      if (g == null || g < 1 || g > 5000) return json(res, 400, { error: 'invalid_guests' });
      q.guests = g;
    }
    if (q.budget != null) {
      const b = toInt(q.budget);
      if (b == null || b < 1000) return json(res, 400, { error: 'invalid_budget' });
      q.budget = b;
    }
    if (q.month != null) {
      const m = Number(q.month);
      if (Number.isInteger(m) && m >= 1 && m <= 12) q.month = m;
      else delete q.month;
    }
    const extractedCriteria = {};
    for (const k of ['wilaya', 'commune', 'date', 'month', 'guests', 'budget', 'style', 'amenities']) {
      const v = q[k];
      if (v === undefined || v === null || v === '') continue;
      if (k === 'amenities') {
        if (Array.isArray(v) && v.length) extractedCriteria[k] = [...v];
        continue;
      }
      extractedCriteria[k] = v;
    }
    const candidates = await filterHalls(q);
    // Try live Muse Spark first.
    let fallbackReason = null;
    if (meta.isConfigured() && candidates.length) {
      const live = await meta.sparkRank(q, candidates, { prompt, lang });
      if (live.ok) {
        const valid = new Map(candidates.map((h) => [h.id, h]));
        const seen = new Set();
        const ranking = [];
        for (const r of live.ranking) {
          if (!r || typeof r.id !== 'string' || !valid.has(r.id) || seen.has(r.id)) continue;
          seen.add(r.id);
          let s = Number(r.score);
          if (!Number.isFinite(s)) s = 50;
          s = Math.max(0, Math.min(100, Math.round(s)));
          ranking.push({ id: r.id, score: s, reason: String(r.reason || '').slice(0, 300) });
        }
        if (ranking.length) {
          if (ranking.length < candidates.length) {
            for (const f of await cachedRanking(q, lang)) {
              if (!seen.has(f.id) && valid.has(f.id)) {
                seen.add(f.id);
                ranking.push(f);
              }
            }
          }
          const hallsOut = ranking.map((r) => ({
            ...valid.get(r.id),
            wilayaName: wilayaByCode.get(valid.get(r.id).wilaya) || null,
          }));
          return json(res, 200, { mode: 'live', model: live.model, extractedCriteria, ranking, halls: hallsOut, count: candidates.length });
        }
        fallbackReason = 'no_valid_ranking';
      } else {
        fallbackReason = live.error || 'live_failed';
      }
    }
    if (!fallbackReason) {
      if (!candidates.length) fallbackReason = 'no_candidates';
      else if (!meta.isConfigured()) fallbackReason = 'missing_api_key';
      else fallbackReason = 'live_failed';
    }
    const ranking = await cachedRanking(q, lang);
    const hallsOut = ranking
      .map((r) => hallById.get(r.id))
      .filter(Boolean)
      .map((h) => ({ ...h, wilayaName: wilayaByCode.get(h.wilaya) || null }));
    return json(res, 200, {
      mode: 'cached',
      model: 'walimapp-demo-rank-1',
      extractedCriteria,
      ranking,
      halls: hallsOut,
      count: candidates.length,
      fallbackReason,
      note: {
        fr: 'Classement de démonstration (Muse Spark non connecté).',
        ar: 'ترتيب تجريبي (Muse Spark غير متصل).',
        en: 'Demo ranking (Muse Spark not connected).',
      }[lang],
    });
  }

  if (method === 'POST' && pathname === '/api/ai/segment') {
    const body = await readJson(req);
    const lang = pickLang(body.lang);
    const b64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
    if (!b64 || b64.length < 100 || b64.length > 6 * 1024 * 1024) {
      return json(res, 400, { error: 'invalid_image' });
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return json(res, 400, { error: 'unsupported_image_type' });
    }
    if (meta.isConfigured()) {
      const live = await meta.samSegment({ imageBase64: b64, mimeType });
      if (live.ok) {
        return json(res, 200, {
          mode: 'live',
          model: live.model,
          regions: live.regions.map((r) => ({
            label: r.label,
            labelLocal: (SEG_LABELS[r.label] && t(SEG_LABELS[r.label], lang)) || r.label,
            box: r.box,
            confidence: r.confidence,
          })),
        });
      }
    }
    return json(res, 200, {
      mode: 'cached',
      model: 'walimapp-demo-seg-1',
      regions: cachedSegmentation().map((r) => ({
        label: r.key,
        labelLocal: t(SEG_LABELS[r.key], lang),
        box: r.box,
        confidence: r.confidence,
      })),
      note: {
        fr: 'Segmentation de démonstration (SAM 3.1 non connecté).',
        ar: 'تجزئة تجريبية (SAM 3.1 غير متصل).',
        en: 'Demo segmentation (SAM 3.1 not connected).',
      }[lang],
    });
  }

  if (method === 'POST' && pathname === '/api/ai/decorate') {
    const body = await readJson(req);
    const lang = pickLang(body.lang);
    const style = STYLES.includes(body.style) ? body.style : 'moderne';
    const palette = Object.keys(PALETTES).includes(body.palette) ? body.palette : 'gold';
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : '';
    const concept = CONCEPTS[style];
    const altStyle = STYLES[(STYLES.indexOf(style) + 2) % STYLES.length];
    const alt = CONCEPTS[altStyle];

    let liveImage = null;
    if (meta.isConfigured()) {
      const prompt =
        `Elegant Algerian wedding hall decoration concept, ${style} style, ` +
        `${palette} palette. ${notes}`.slice(0, 900);
      const live = await meta.imageGenerate({ prompt });
      if (live.ok && live.b64) liveImage = `data:${live.mime || 'image/png'};base64,${live.b64}`;
      else if (live.ok && live.url) liveImage = live.url;
    }
    const concepts = [
      {
        title: t(concept.title, lang),
        description: t(concept.desc, lang),
        palette: PALETTES[palette],
        paletteName: palette,
        tips: concept.tips[lang] || concept.tips.fr,
        imageDataUrl: liveImage || svgConceptArt(style, palette, t(concept.title, lang)),
        imageMode: liveImage ? 'live' : 'cached',
      },
      {
        title: t(alt.title, lang),
        description: t(alt.desc, lang),
        palette: PALETTES.gold,
        paletteName: 'gold',
        tips: alt.tips[lang] || alt.tips.fr,
        imageDataUrl: svgConceptArt(altStyle, 'gold', t(alt.title, lang)),
        imageMode: 'cached',
      },
    ];
    return json(res, 200, {
      mode: liveImage ? 'live' : 'cached',
      model: liveImage ? meta.MODELS.image : 'walimapp-demo-deco-1',
      concepts,
      note: liveImage
        ? null
        : {
            fr: 'Concepts de démonstration (Muse Image non connecté).',
            ar: 'أفكار تجريبية (Muse Image غير متصل).',
            en: 'Demo concepts (Muse Image not connected).',
          }[lang],
    });
  }

  if (method === 'POST' && pathname === '/api/inquiries') {
    const body = await readJson(req);
    const lang = pickLang(body.lang);
    let hall = hallById.get(body.hallId);
    if (!hall) {
      try {
        hall = await storage.getHallById(body.hallId);
        if (hall) syncHallToMemory(hall);
      } catch {
        hall = null;
      }
    }
    if (!hall) return json(res, 400, { error: 'invalid_hall' });
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2 || name.length > 80) return json(res, 400, { error: 'invalid_name' });
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!/^[+0-9][0-9 .()-]{5,19}$/.test(phone)) return json(res, 400, { error: 'invalid_phone' });
    if (!validDate(body.date || '')) return json(res, 400, { error: 'invalid_date' });
    const guests = toInt(body.guests);
    if (guests == null || guests < 1 || guests > 5000) return json(res, 400, { error: 'invalid_guests' });
    const message = typeof body.message === 'string' ? body.message.slice(0, 1000) : '';
    if (body.consent !== true) return json(res, 400, { error: 'consent_required' });

    // Guest-safe: link the inquiry to the customer when a valid session
    // cookie is present, otherwise store it as a guest booking.
    let customerId = null;
    try {
      const cookies = auth.parseCookies(req.headers.cookie);
      const token = cookies[auth.SESSION_COOKIE];
      if (token) {
        const sess = await storage.findSession(token);
        if (sess) customerId = sess.userId;
      }
    } catch { /* guest booking */ }

    const list = await storage.loadInquiries();
    const reference = newReference(list);
    const inquiry = {
      reference,
      status: 'pending', // Starts pending (en attente); blocks availability only once accepted/confirmed by the hall owner.
      hallId: hall.id,
      hallName: hall.name,
      wilaya: hall.wilaya,
      name,
      phone,
      date: body.date,
      guests,
      message,
      consent: true,
      consentAt: new Date().toISOString(),
      lang,
      createdAt: new Date().toISOString(),
      customerId,
    };
    await storage.saveInquiry(inquiry);
    return json(res, 201, {
      reference,
      status: 'pending',
      hallId: hall.id,
      message: {
        fr: 'Demande envoyée. Elle reste en attente de validation par la salle.',
        ar: 'تم إرسال الطلب. سيبقى قيد الانتظار حتى تؤكده القاعة.',
        en: 'Inquiry sent. It stays pending until the hall confirms.',
      }[lang],
    });
  }

  // --- customer authentication -------------------------------------------------

  if (method === 'POST' && pathname === '/api/auth/register') {
    if (!auth.allowRate(getClientIp(req), 'register')) {
      return json(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    }
    const body = await readJson(req);
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = auth.normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    if (!auth.validName(fullName)) return json(res, 400, { error: 'invalid_name' });
    if (!auth.validEmail(email)) return json(res, 400, { error: 'invalid_email' });
    if (!auth.validPassword(password)) return json(res, 400, { error: 'invalid_password' });
    if (password !== confirmPassword) return json(res, 400, { error: 'password_mismatch' });
    if (await storage.findUserByEmail(email)) {
      return json(res, 409, { error: 'email_already_registered' });
    }
    let user;
    try {
      user = await storage.createUser({
        id: crypto.randomUUID(),
        email,
        passwordHash: auth.hashPassword(password),
        fullName,
        role: 'customer', // Role is always customer here; owners apply via /owner-register.
        status: 'approved',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err && err.code === 'DUPLICATE_EMAIL') {
        return json(res, 409, { error: 'email_already_registered' });
      }
      throw err;
    }
    const token = auth.generateSessionToken();
    await storage.saveSession({
      token,
      userId: user.id,
      role: user.role,
      createdAt: new Date().toISOString(),
      expiresAt: auth.newExpiry(),
    });
    return json(res, 201, { ok: true, user: auth.publicUser(user) }, { 'Set-Cookie': auth.sessionCookie(token) });
  }

  // Task 08: public owner application. Role/status are forced server-side;
  // any client-supplied role or status is ignored.
  if (method === 'POST' && pathname === '/api/auth/owner-register') {
    if (!auth.allowRate(getClientIp(req), 'owner-register')) {
      return json(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    }
    const body = await readJson(req);
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = auth.normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const wilaya = typeof body.wilaya === 'number' ? String(body.wilaya).padStart(2, '0') : body.wilaya;
    const commune = typeof body.commune === 'string' ? body.commune.trim() : '';
    const businessDescription = typeof body.businessDescription === 'string' ? body.businessDescription.trim() : '';
    if (!auth.validName(fullName)) return json(res, 400, { error: 'invalid_name' });
    if (!auth.validEmail(email)) return json(res, 400, { error: 'invalid_email' });
    if (!auth.validPassword(password)) return json(res, 400, { error: 'invalid_password' });
    if (password !== confirmPassword) return json(res, 400, { error: 'password_mismatch' });
    if (!/^[+0-9][0-9 .()-]{5,19}$/.test(phone)) return json(res, 400, { error: 'invalid_phone' });
    if (businessName.length < 2 || businessName.length > 120) return json(res, 400, { error: 'invalid_business_name' });
    if (!validWilaya(wilaya)) return json(res, 400, { error: 'invalid_wilaya' });
    if (!commune || commune.length > 60) return json(res, 400, { error: 'invalid_commune' });
    if (!businessDescription || businessDescription.length > 1000) return json(res, 400, { error: 'invalid_business_description' });
    if (await storage.findUserByEmail(email)) {
      return json(res, 409, { error: 'email_already_registered' });
    }
    let user;
    try {
      user = await storage.createUser({
        id: crypto.randomUUID(),
        email,
        passwordHash: auth.hashPassword(password),
        fullName,
        role: 'owner',
        status: 'pending',
        phone,
        businessName,
        wilaya,
        commune,
        businessDescription,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      if (err && err.code === 'DUPLICATE_EMAIL') {
        return json(res, 409, { error: 'email_already_registered' });
      }
      throw err;
    }
    const token = auth.generateSessionToken();
    await storage.saveSession({
      token,
      userId: user.id,
      role: user.role,
      createdAt: new Date().toISOString(),
      expiresAt: auth.newExpiry(),
    });
    return json(res, 201, { ok: true, user: auth.publicUser(user) }, { 'Set-Cookie': auth.sessionCookie(token) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!auth.allowRate(getClientIp(req), 'login')) {
      return json(res, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    }
    const body = await readJson(req);
    const email = auth.normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    if (process.env.OWNER_EMAIL && email === auth.normalizeEmail(process.env.OWNER_EMAIL)) {
      try {
        await auth.ensureOwnerUser();
      } catch { /* login will fail below if sync failed */ }
    }
    if (process.env.ADMIN_EMAIL && email === auth.normalizeEmail(process.env.ADMIN_EMAIL)) {
      try {
        await auth.ensureAdminUser();
      } catch { /* login will fail below if sync failed */ }
    }
    const user = email ? await storage.findUserByEmail(email) : null;
    if (!user || !password || !auth.verifyPassword(password, user.passwordHash)) {
      return json(res, 401, { error: 'invalid_credentials' });
    }
    const token = auth.generateSessionToken();
    await storage.saveSession({
      token,
      userId: user.id,
      role: user.role,
      createdAt: new Date().toISOString(),
      expiresAt: auth.newExpiry(),
    });
    return json(res, 200, { ok: true, user: auth.publicUser(user) }, { 'Set-Cookie': auth.sessionCookie(token) });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = auth.parseCookies(req.headers.cookie);
    const token = cookies[auth.SESSION_COOKIE];
    if (token) {
      try {
        await storage.deleteSession(token);
      } catch { /* already gone */ }
    }
    return json(res, 200, { ok: true }, { 'Set-Cookie': auth.clearSessionCookie() });
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    const ctx = await getAuthContext(req);
    if (!ctx.session || !ctx.user) return json(res, 200, { authenticated: false });
    return json(res, 200, { authenticated: true, user: auth.publicUser(ctx.user) });
  }

  if (method === 'GET' && pathname === '/api/auth/owner-status') {
    return json(res, 200, { configured: Boolean(process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) });
  }

  // --- Task 08: super admin ------------------------------------------------------

  if (method === 'GET' && pathname === '/api/admin/metrics') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const users = await storage.loadUsers();
    const owners = users.filter((u) => u && u.role === 'owner');
    const byStatus = { pending: 0, approved: 0, rejected: 0, suspended: 0 };
    for (const o of owners) {
      const s = o.status || 'approved';
      if (byStatus[s] != null) byStatus[s] += 1;
    }
    const allHalls = await storage.getHalls();
    const ownerById = new Map(users.map((u) => [u.id, u]));
    const publishedHalls = allHalls.filter((h) => {
      if (!h.ownerId) return true;
      const o = ownerById.get(h.ownerId);
      if (!o) return true;
      return (o.status || 'approved') === 'approved';
    }).length;
    return json(res, 200, {
      totalCustomers: users.filter((u) => u && u.role === 'customer').length,
      totalOwners: owners.length,
      pendingOwners: byStatus.pending,
      approvedOwners: byStatus.approved,
      rejectedOwners: byStatus.rejected,
      suspendedOwners: byStatus.suspended,
      totalHalls: allHalls.length,
      publishedHalls,
    });
  }

  if (method === 'GET' && pathname === '/api/admin/owners') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const owners = await storage.findOwners();
    const allHalls = await storage.getHalls();
    const hallCounts = new Map();
    for (const h of allHalls) {
      if (h && h.ownerId) hallCounts.set(h.ownerId, (hallCounts.get(h.ownerId) || 0) + 1);
    }
    const list = owners
      .map((o) => ({
        id: o.id,
        email: o.email,
        fullName: o.fullName,
        phone: o.phone || null,
        businessName: o.businessName || null,
        wilaya: o.wilaya || null,
        commune: o.commune || null,
        businessDescription: o.businessDescription || null,
        status: o.status || 'approved',
        createdAt: o.createdAt,
        hallCount: hallCounts.get(o.id) || 0,
      }))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json(res, 200, { count: list.length, owners: list });
  }

  if (method === 'POST' && pathname.startsWith('/api/admin/owners/') && pathname.endsWith('/status')) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = decodeURIComponent(pathname.slice('/api/admin/owners/'.length, -'/status'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'owner_not_found' });
    const body = await readJson(req);
    if (body.status !== 'approved' && body.status !== 'rejected' && body.status !== 'suspended') {
      return json(res, 400, { error: 'invalid_status' });
    }
    const target = await storage.findUserById(id);
    if (!target || target.role !== 'owner') return json(res, 404, { error: 'owner_not_found' });
    const updated = await storage.updateUserStatus(id, body.status);
    return json(res, 200, { ok: true, owner: auth.publicUser(updated) });
  }

  // --- personal customer bookings ---------------------------------------------

  if (method === 'GET' && pathname === '/api/customer/inquiries') {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const mine = (await storage.findInquiriesByCustomer(ctx.session.userId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const counts = { total: mine.length, pending: 0, confirmed: 0, rejected: 0 };
    mine.forEach((i) => {
      if (counts[i.status] != null) counts[i.status] += 1;
    });
    return json(res, 200, { count: mine.length, counts, inquiries: mine });
  }

  if (method === 'GET' && pathname.startsWith('/api/customer/inquiries/')) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const ref = decodeURIComponent(pathname.slice('/api/customer/inquiries/'.length));
    if (!ref || ref.includes('/')) return json(res, 404, { error: 'inquiry_not_found' });
    const inq = await storage.findInquiryByReference(ref);
    if (!inq || inq.customerId !== ctx.session.userId) {
      return json(res, 404, { error: 'inquiry_not_found' });
    }
    return json(res, 200, { inquiry: inq });
  }

  // Demo owner inbox: full records including contact details.
  // Task 08: strictly isolated per owner — only inquiries for halls owned by
  // the authenticated owner (plus legacy unclaimed seed halls).
  if (method === 'GET' && pathname === '/api/owner/inquiries') {
    const owner = await requireOwner(req, res, { allowPending: true });
    if (!owner) return;
    await refreshHallsFromStorage();
    const status = url.searchParams.get('status') || '';
    const hallId = url.searchParams.get('hallId') || '';
    const date = url.searchParams.get('date') || '';
    if (status && !INQUIRY_STATUSES.includes(status)) return json(res, 400, { error: 'invalid_status' });
    if (hallId && !hallById.has(hallId)) return json(res, 400, { error: 'invalid_hall' });
    if (date && !validDate(date)) return json(res, 400, { error: 'invalid_date' });
    const owned = (await storage.loadInquiries()).filter((i) => {
      const hall = hallById.get(i.hallId);
      return !hall || !hall.ownerId || hall.ownerId === owner.session.userId;
    });
    const counts = { total: owned.length, pending: 0, confirmed: 0, rejected: 0 };
    owned.forEach((i) => {
      if (counts[i.status] != null) counts[i.status] += 1;
    });
    const list = owned
      .filter((i) => (!status || i.status === status) && (!hallId || i.hallId === hallId) && (!date || i.date === date))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json(res, 200, { count: list.length, counts, inquiries: list });
  }

  if (method === 'POST' && pathname.startsWith('/api/owner/inquiries/') && pathname.endsWith('/decision')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const ref = decodeURIComponent(pathname.slice('/api/owner/inquiries/'.length, -'/decision'.length));
    if (!ref || ref.includes('/')) return json(res, 404, { error: 'inquiry_not_found' });
    const body = await readJson(req);
    if (body.decision !== 'accept' && body.decision !== 'reject') {
      return json(res, 400, { error: 'invalid_decision' });
    }
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : '';
    const list = await storage.loadInquiries();
    const inq = list.find((i) => i.reference === ref);
    if (!inq) return json(res, 404, { error: 'inquiry_not_found' });
    // Task 08: an owner may only decide inquiries for their own halls.
    await refreshHallsFromStorage();
    let inqHall = hallById.get(inq.hallId);
    if (!inqHall) {
      try {
        inqHall = await storage.getHallById(inq.hallId);
      } catch {
        inqHall = null;
      }
    }
    if (inqHall && inqHall.ownerId && inqHall.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall inquiry' });
    }
    if (inq.status !== 'pending') {
      return json(res, 409, { error: 'already_decided', status: inq.status });
    }
    if (body.decision === 'accept') {
      const conflict = list.find(
        (i) => i.reference !== inq.reference && i.hallId === inq.hallId && i.date === inq.date && i.status === 'confirmed'
      );
      if (conflict) {
        return json(res, 409, {
          error: 'date_already_booked',
          hallId: inq.hallId,
          date: inq.date,
          conflictingReference: conflict.reference,
        });
      }
    }
    inq.status = body.decision === 'accept' ? 'confirmed' : 'rejected';
    inq.ownerNote = note;
    inq.decidedAt = new Date().toISOString();
    await storage.updateInquiry(inq.reference, { status: inq.status, ownerNote: inq.ownerNote, decidedAt: inq.decidedAt });
    return json(res, 200, { reference: inq.reference, status: inq.status, decidedAt: inq.decidedAt });
  }

  // --- Task 04: owner hall CRUD --------------------------------------------------

  if (method === 'GET' && pathname === '/api/owner/halls') {
    const owner = await requireOwner(req, res, { allowPending: true });
    if (!owner) return;
    // Task 08: only the seed demo owner inherits legacy unclaimed halls;
    // other owners strictly see halls they created.
    const isSeedOwner = Boolean(process.env.OWNER_EMAIL) &&
      auth.normalizeEmail(owner.user.email) === auth.normalizeEmail(process.env.OWNER_EMAIL);
    if (isSeedOwner && (owner.user.status || 'approved') === 'approved') {
      try {
        await storage.claimUnownedHalls(owner.session.userId);
      } catch {
        /* seeding best effort */
      }
    }
    const all = await storage.getHalls();
    halls.length = 0;
    hallById.clear();
    for (const h of all) {
      halls.push(h);
      hallById.set(h.id, h);
    }
    const owned = all.filter((h) => h.ownerId === owner.session.userId);
    return json(res, 200, { ok: true, count: owned.length, halls: owned });
  }

  if (method === 'POST' && pathname === '/api/owner/halls') {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const body = await readJson(req);
    const v = validateHallCreate(body || {});
    if (v.error) return json(res, 400, { error: v.error });
    let id = typeof body.id === 'string' && body.id.trim()
      ? body.id.trim().slice(0, 64)
      : `h-${crypto.randomBytes(4).toString('hex')}`;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) id = `h-${crypto.randomBytes(4).toString('hex')}`;
    try {
      const exists = (await storage.getHallById(id)) || hallById.get(id);
      if (exists) id = `h-${crypto.randomBytes(6).toString('hex')}`;
    } catch {
      /* uniqueness best effort */
    }
    try {
      const created = await storage.createHall({ ...v.data, id }, owner.session.userId);
      syncHallToMemory(created);
      return json(res, 201, { ok: true, hall: created });
    } catch (err) {
      if (err && err.code === 'DUPLICATE_HALL') return json(res, 409, { error: 'hall_exists' });
      throw err;
    }
  }

  // --- 360° tour: panorama upload, scene wiring, scene deletion ---------------

  if (method === 'POST' && pathname.startsWith('/api/owner/halls/') && pathname.endsWith('/panoramas')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length, -'/panoramas'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const body = await readJson(req);
    const mimeType = body.mimeType;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return json(res, 400, { error: 'unsupported_image_type' });
    }
    let b64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    if (!b64) return json(res, 400, { error: 'invalid_image' });
    if (b64.startsWith('data:')) {
      const comma = b64.indexOf(',');
      if (comma >= 0) b64 = b64.slice(comma + 1);
    }
    b64 = b64.replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || !b64.length) {
      return json(res, 400, { error: 'invalid_image' });
    }
    let buf;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      return json(res, 400, { error: 'invalid_image' });
    }
    if (!buf.length) return json(res, 400, { error: 'invalid_image' });
    if (buf.length > MAX_PANORAMA_BYTES) return json(res, 400, { error: 'image_too_large' });
    const size = imageMeta.imageSize(buf);
    if (!size) return json(res, 400, { error: 'invalid_image' });
    const ratio = size.width / size.height;
    if (ratio < PANORAMA_RATIO_MIN || ratio > PANORAMA_RATIO_MAX) {
      return json(res, 400, {
        error: 'not_equirectangular',
        message: 'Image must be an equirectangular panorama with ~2:1 aspect ratio (recommended 4096x2048)',
      });
    }
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 80)
      : 'Scene';
    const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.webp';
    const filename = `${crypto.randomUUID()}${ext}`;
    const panoDir = path.join(PUBLIC, 'uploads', 'panoramas');
    fs.mkdirSync(panoDir, { recursive: true });
    const dest = path.join(panoDir, filename);
    if (!dest.startsWith(panoDir)) return json(res, 400, { error: 'invalid_image' });
    fs.writeFileSync(dest, buf);
    const scene = {
      id: `scene-${crypto.randomUUID().slice(0, 8)}`,
      title,
      panorama: `/uploads/panoramas/${filename}`,
      hotSpots: [],
    };
    const tourScenes = [...(Array.isArray(existing.tourScenes) ? existing.tourScenes : []), scene];
    try {
      const updated = await storage.updateHall(id, { tourScenes }, owner.session.userId);
      const finalScenes = updated ? updated.tourScenes : tourScenes;
      syncHallToMemory(updated || { ...existing, tourScenes });
      return json(res, 200, { ok: true, tourScenes: finalScenes });
    } catch (err) {
      try {
        fs.unlinkSync(dest);
      } catch {
        /* cleanup best effort */
      }
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/owner/halls/') && pathname.endsWith('/tour')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length, -'/tour'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const body = await readJson(req);
    if (!Array.isArray(body.tourScenes) || body.tourScenes.length > 30) {
      return json(res, 400, { error: 'invalid_tourScenes' });
    }
    const storedById = new Map(
      (Array.isArray(existing.tourScenes) ? existing.tourScenes : [])
        .filter((s) => s && typeof s.id === 'string')
        .map((s) => [s.id, s])
    );
    const nextScenes = [];
    const nextIds = new Set();
    for (const s of body.tourScenes) {
      // Scenes must belong to the hall: unknown ids or swapped panoramas are rejected.
      if (!s || typeof s.id !== 'string' || !storedById.has(s.id) || nextIds.has(s.id)) {
        return json(res, 400, { error: 'invalid_tourScenes' });
      }
      const stored = storedById.get(s.id);
      if (s.panorama !== undefined && s.panorama !== stored.panorama) {
        return json(res, 400, { error: 'invalid_tourScenes' });
      }
      nextIds.add(s.id);
      nextScenes.push({
        id: s.id,
        title: typeof s.title === 'string' && s.title.trim()
          ? s.title.trim().slice(0, 80)
          : (stored.title !== undefined ? stored.title : 'Scene'),
        panorama: stored.panorama,
        hotSpots: [], // filled after all ids are known so targets can be validated
      });
      nextScenes[nextScenes.length - 1]._rawSpots = s.hotSpots;
    }
    for (const scene of nextScenes) {
      const raw = scene._rawSpots === undefined ? [] : scene._rawSpots;
      if (!Array.isArray(raw) || raw.length > 20) return json(res, 400, { error: 'invalid_hotspots' });
      const spots = [];
      for (const hp of raw) {
        const target = hp && (hp.targetSceneId || hp.sceneId);
        if (!hp || typeof target !== 'string' || !nextIds.has(target) || target === scene.id) {
          return json(res, 400, { error: 'invalid_hotspots' });
        }
        spots.push({
          pitch: Number.isFinite(Number(hp.pitch)) ? Number(hp.pitch) : 0,
          yaw: Number.isFinite(Number(hp.yaw)) ? Number(hp.yaw) : 0,
          text: typeof hp.text === 'string' ? hp.text.slice(0, 120) : '',
          targetSceneId: target,
        });
      }
      scene.hotSpots = spots;
      delete scene._rawSpots;
    }
    let firstScene = null;
    if (body.firstScene !== undefined && body.firstScene !== null && body.firstScene !== '') {
      if (typeof body.firstScene !== 'string' || !nextIds.has(body.firstScene)) {
        return json(res, 400, { error: 'invalid_firstScene' });
      }
      firstScene = body.firstScene;
    }
    try {
      const updated = await storage.updateHall(
        id,
        { tourScenes: nextScenes, firstTourScene: firstScene },
        owner.session.userId
      );
      syncHallToMemory(updated || { ...existing, tourScenes: nextScenes, firstTourScene: firstScene });
      return json(res, 200, {
        ok: true,
        tourScenes: updated ? updated.tourScenes : nextScenes,
        firstScene: updated ? (updated.firstTourScene || null) : firstScene,
      });
    } catch (err) {
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  if (method === 'DELETE' && pathname.includes('/panoramas/') && pathname.startsWith('/api/owner/halls/')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const rest = decodeURIComponent(pathname.slice('/api/owner/halls/'.length));
    const parts = rest.split('/');
    if (parts.length !== 3 || parts[1] !== 'panoramas' || !parts[0] || !parts[2]) {
      return json(res, 404, { error: 'scene_not_found' });
    }
    const [id, , sceneId] = parts;
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const scenes = Array.isArray(existing.tourScenes) ? existing.tourScenes : [];
    const scene = scenes.find((s) => s && s.id === sceneId);
    if (!scene) return json(res, 404, { error: 'scene_not_found' });
    if (typeof scene.panorama === 'string' && scene.panorama.startsWith('/uploads/panoramas/')) {
      const base = path.basename(scene.panorama);
      if (/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(jpg|jpeg|png|webp)$/i.test(base)) {
        const panoDir = path.join(PUBLIC, 'uploads', 'panoramas');
        const filePath = path.join(panoDir, base);
        if (filePath.startsWith(panoDir)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            /* already gone */
          }
        }
      }
    }
    const tourScenes = scenes
      .filter((s) => s && s.id !== sceneId)
      .map((s) => ({
        ...s,
        hotSpots: (Array.isArray(s.hotSpots) ? s.hotSpots : [])
          .filter((hp) => hp && (hp.targetSceneId || hp.sceneId) !== sceneId),
      }));
    const firstTourScene = existing.firstTourScene === sceneId
      ? (tourScenes.length ? tourScenes[0].id : null)
      : (existing.firstTourScene || null);
    try {
      const updated = await storage.updateHall(id, { tourScenes, firstTourScene }, owner.session.userId);
      syncHallToMemory(updated || { ...existing, tourScenes, firstTourScene });
      return json(res, 200, { ok: true, tourScenes: updated ? updated.tourScenes : tourScenes });
    } catch (err) {
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/owner/halls/') && !pathname.endsWith('/photos') && !pathname.endsWith('/tour')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const body = await readJson(req);
    const v = validateHallUpdate(body || {});
    if (v.error) return json(res, 400, { error: v.error });
    if (v.updates.capacityMin == null && body.capacityMin == null) {
      // cross-check min/max against existing when only one side changes
    }
    const effMin = v.updates.capacityMin != null ? v.updates.capacityMin : existing.capacityMin;
    const effMax = v.updates.capacityMax != null ? v.updates.capacityMax : existing.capacityMax;
    if (effMin != null && effMax != null && effMin > effMax) {
      return json(res, 400, { error: 'invalid_capacity' });
    }
    try {
      const updated = await storage.updateHall(id, v.updates, owner.session.userId);
      if (!updated) return json(res, 404, { error: 'hall_not_found' });
      syncHallToMemory(updated);
      return json(res, 200, { ok: true, hall: updated });
    } catch (err) {
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  if (method === 'DELETE' && pathname.startsWith('/api/owner/halls/') && !pathname.endsWith('/photos')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    try {
      const removed = await storage.deleteHall(id, owner.session.userId);
      if (!removed) return json(res, 404, { error: 'hall_not_found' });
      removeHallFromMemory(id);
      return json(res, 200, { ok: true });
    } catch (err) {
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  // --- Task 04: secure photo gallery uploads ------------------------------------

  if (method === 'POST' && pathname.startsWith('/api/owner/halls/') && pathname.endsWith('/photos')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length, -'/photos'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const body = await readJson(req);
    const mimeType = body.mimeType;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return json(res, 400, { error: 'unsupported_image_type' });
    }
    let b64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : '';
    if (!b64) return json(res, 400, { error: 'invalid_image' });
    if (b64.startsWith('data:')) {
      const comma = b64.indexOf(',');
      if (comma >= 0) b64 = b64.slice(comma + 1);
    }
    b64 = b64.replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || !b64.length) {
      return json(res, 400, { error: 'invalid_image' });
    }
    let buf;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      return json(res, 400, { error: 'invalid_image' });
    }
    if (!buf.length) return json(res, 400, { error: 'invalid_image' });
    if (buf.length > 5 * 1024 * 1024) return json(res, 400, { error: 'image_too_large' });
    const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : '.webp';
    const filename = `${crypto.randomUUID()}${ext}`;
    const uploadDir = path.join(PUBLIC, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    const dest = path.join(uploadDir, filename);
    if (!dest.startsWith(uploadDir)) return json(res, 400, { error: 'invalid_image' });
    fs.writeFileSync(dest, buf);
    const photoUrl = `/uploads/${filename}`;
    const photos = Array.isArray(existing.photos) ? [...existing.photos, photoUrl] : [photoUrl];
    try {
      const updated = await storage.updateHall(id, { photos }, owner.session.userId);
      const finalPhotos = updated ? updated.photos : photos;
      syncHallToMemory(updated || { ...existing, photos });
      return json(res, 200, { ok: true, photos: finalPhotos });
    } catch (err) {
      try {
        fs.unlinkSync(dest);
      } catch {
        /* cleanup best effort */
      }
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  if (method === 'DELETE' && pathname.startsWith('/api/owner/halls/') && pathname.endsWith('/photos')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length, -'/photos'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const body = await readJson(req);
    const photoUrl = body.photoUrl;
    if (typeof photoUrl !== 'string' || !photoUrl) return json(res, 400, { error: 'invalid_photo' });
    const photos = (Array.isArray(existing.photos) ? existing.photos : []).filter((p) => p !== photoUrl);
    if (photoUrl.startsWith('/uploads/')) {
      const base = path.basename(photoUrl);
      if (/^[A-Za-z0-9][A-Za-z0-9_.-]*\.(jpg|jpeg|png|webp)$/i.test(base)) {
        const uploadDir = path.join(PUBLIC, 'uploads');
        const filePath = path.join(uploadDir, base);
        if (filePath.startsWith(uploadDir)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            /* already gone */
          }
        }
      }
    }
    try {
      const updated = await storage.updateHall(id, { photos }, owner.session.userId);
      const finalPhotos = updated ? updated.photos : photos;
      syncHallToMemory(updated || { ...existing, photos });
      return json(res, 200, { ok: true, photos: finalPhotos });
    } catch (err) {
      if (err && err.code === 'FORBIDDEN') return json(res, 403, { error: 'forbidden' });
      throw err;
    }
  }

  // --- Task 05: AI venue advisor -------------------------------------------------

  if (method === 'POST' && pathname.startsWith('/api/owner/halls/') && pathname.endsWith('/advisor')) {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const id = decodeURIComponent(pathname.slice('/api/owner/halls/'.length, -'/advisor'.length));
    if (!id || id.includes('/')) return json(res, 404, { error: 'hall_not_found' });
    const existing = (await storage.getHallById(id)) || hallById.get(id);
    if (!existing) return json(res, 404, { error: 'hall_not_found' });
    if (existing.ownerId && existing.ownerId !== owner.session.userId) {
      return json(res, 403, { error: 'forbidden', message: 'Not your hall' });
    }
    const body = (await readJson(req)) || {};
    const lang = pickLang(body.lang);
    const storedPhotos = Array.isArray(existing.photos)
      ? existing.photos.filter((p) => typeof p === 'string' && p)
      : [];
    const selectedPhotos = Array.isArray(body.selectedPhotos)
      ? body.selectedPhotos.filter((p) => typeof p === 'string' && p).slice(0, 5)
      : storedPhotos.slice(0, 5);
    const result = await meta.venueAdvisor(existing, selectedPhotos, { lang });
    return json(res, 200, {
      mode: result.mode,
      model: result.model,
      hallId: existing.id,
      facts: meta.advisorFacts(existing, selectedPhotos),
      report: result.report,
      note: result.note || null,
    });
  }

  // Public tracking lookup: privacy-safe, no name/phone.
  if (method === 'GET' && pathname.startsWith('/api/inquiries/')) {
    const ref = decodeURIComponent(pathname.slice('/api/inquiries/'.length));
    if (!ref || ref.includes('/')) return json(res, 404, { error: 'inquiry_not_found' });
    const inq = await storage.findInquiryByReference(ref);
    if (!inq) return json(res, 404, { error: 'inquiry_not_found' });
    return json(res, 200, { inquiry: publicInquiry(inq) });
  }

  return json(res, 404, { error: 'not_found' });
}

// --- server --------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname, url);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    json(res, err && err.status ? err.status : 500, {
      error: err && err.message ? err.message : 'server_error',
    });
  }
});

auth.ensureOwnerUser().catch((err) => {
  console.log(`owner sync skipped: ${err && err.message ? err.message : err}`);
});
auth.ensureAdminUser().catch((err) => {
  console.log(`admin sync skipped: ${err && err.message ? err.message : err}`);
});
storage.getMode().then(
  (mode) => console.log(`storage: ${mode} mode`),
  () => console.log('storage: file mode')
);

server.listen(PORT, () => {
  console.log(`WalimApp AI demo running at http://localhost:${PORT}`);
  console.log(`Meta API: ${meta.isConfigured() ? `key configured (${meta.META_BASE})` : 'no key — cached demo mode'}`);
});
