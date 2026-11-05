// WalimApp AI — Meta Model API client (server-side only).
// Verified against official docs (dev.meta.ai) on 2026-11-03:
//   Base URL : https://api.meta.ai/v1
//   Auth     : Authorization: Bearer <MODEL_API_KEY>
//   Muse Spark reasoning : model "muse-spark-1.3" via POST /v1/chat/completions
//                          (OpenAI-compatible) — also /v1/responses, /v1/messages.
//   SAM 3.1 segmentation : model "sam-3.1" via POST /v1/responses (streaming SSE).
//   Muse Image generation: model "muse-image-1.0" via POST /v1/images/generations
//                          (single-shot) or the conversational /v1/responses API.
// All calls are best-effort with bounded timeouts. Any failure (missing key,
// network error, non-2xx, unparseable payload) resolves to { ok:false } so the
// server can fall back to the cached demo mode and label it honestly.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          value = value.slice(1, -1);
        }
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Best effort: missing/unreadable .env means cached demo mode.
  }
}

loadDotEnv();

const META_BASE = (process.env.META_API_BASE || 'https://api.meta.ai/v1').replace(/\/+$/, '');

const MODELS = {
  spark: process.env.META_SPARK_MODEL || 'muse-spark-1.3',
  sam: process.env.META_SAM_MODEL || 'sam-3.1',
  image: process.env.META_IMAGE_MODEL || 'muse-image-1.0',
};

function getApiKey() {
  return process.env.MODEL_API_KEY || process.env.META_API_KEY || '';
}

function isConfigured() {
  return getApiKey().length > 0;
}

async function postJson(pathSuffix, body, { timeoutMs = 25000 } = {}) {
  const key = getApiKey();
  if (!key) return { ok: false, error: 'missing_api_key' };
  const model = body && body.model;
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${META_BASE}${pathSuffix}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`[meta] POST ${pathSuffix} model=${model} -> HTTP ${res.status} in ${Date.now() - start}ms`);
      return { ok: false, error: `http_${res.status}`, detail: text.slice(0, 300) };
    }
    try {
      const json = JSON.parse(text);
      console.log(`[meta] POST ${pathSuffix} model=${model} -> HTTP ${res.status} in ${Date.now() - start}ms`);
      return { ok: true, status: res.status, json };
    } catch {
      console.log(`[meta] POST ${pathSuffix} model=${model} -> HTTP ${res.status} in ${Date.now() - start}ms`);
      return { ok: false, error: 'bad_json', detail: text.slice(0, 300) };
    }
  } catch (err) {
    const code = err && err.name === 'AbortError' ? 'timeout' : 'network_error';
    console.log(`[meta] POST ${pathSuffix} model=${model} -> FAILED ${code} in ${Date.now() - start}ms`);
    return { ok: false, error: code };
  } finally {
    clearTimeout(timer);
  }
}

// --- Muse Spark: hall ranking ------------------------------------------------
async function sparkRank(criteria, halls, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const prompt = typeof options.prompt === 'string' ? options.prompt.slice(0, 1000) : '';
  const lang = options.lang === 'ar' || options.lang === 'en' ? options.lang : 'fr';
  const langName = lang === 'ar' ? 'Arabic' : lang === 'en' ? 'English' : 'French';
  const sys =
    `You are a wedding-venue advisor for Algeria. Rank ALL provided halls for the couple using ONLY the provided hall records ` +
    `(never invent hall IDs, prices, capacities, or amenities). Keep internal reasoning minimal and output strict JSON immediately: ` +
    `{"ranking":[{"id":"<hall id>","score":0-100,"reason":"<1 concise sentence in ${langName} citing real capacity, priceDzd, commune, and matching amenities>"}]}. ` +
    `No markdown, no extra text.`;
  const hallRecords = halls.map((h) => ({
    id: h.id,
    name: h.name[lang] || h.name.fr,
    wilaya: h.wilaya,
    commune: h.commune,
    priceDzd: h.priceDzd,
    capacityMin: h.capacityMin,
    capacityMax: h.capacityMax,
    styles: h.styles,
    amenities: h.amenities,
  }));
  const parts = [`Criteria: ${JSON.stringify(criteria)}`];
  if (prompt) parts.push(`User request (${lang}): ${prompt}`);
  else parts.push(`Requested language: ${lang}`);
  parts.push(`Halls: ${JSON.stringify(hallRecords)}`);
  const user = parts.join('\n');
  const r = await postJson(
    '/chat/completions',
    {
      model: MODELS.spark,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    },
    { timeoutMs: 45000 }
  );
  if (!r.ok) return r;
  try {
    const content = r.json.choices && r.json.choices[0] && r.json.choices[0].message
      ? String(r.json.choices[0].message.content || '')
      : '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start < 0 || end <= start) return { ok: false, error: 'no_json_in_reply' };
    const parsed = JSON.parse(content.slice(start, end + 1));
    if (!Array.isArray(parsed.ranking)) return { ok: false, error: 'bad_ranking_shape' };
    const out = { ok: true, ranking: parsed.ranking, model: MODELS.spark };
    if (parsed.extractedCriteria && typeof parsed.extractedCriteria === 'object') {
      out.extractedCriteria = parsed.extractedCriteria;
    }
    return out;
  } catch {
    return { ok: false, error: 'rank_parse_failed' };
  }
}

// --- SAM 3.1: segmentation ---------------------------------------------------
// The Responses API streams boxes/masks as a token grammar (SSE) that the
// official @meta-sam/parser decodes. This demo ships dependency-free, so we
// request a non-streaming response and best-effort parse any inline boxes.
// Anything unexpected -> { ok:false } -> cached demo segmentation.
async function samSegment({ imageBase64, mimeType, prompt }) {
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
  const body = {
    model: MODELS.sam,
    stream: false,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt || 'stage, tables, chairs, decorations' },
          { type: 'input_image', image_url: dataUrl },
        ],
      },
    ],
  };
  const r = await postJson('/responses', body, { timeoutMs: 45000 });
  if (!r.ok) return r;
  try {
    const regions = extractBoxes(r.json);
    if (!regions.length) return { ok: false, error: 'no_regions_parsed' };
    return { ok: true, regions, model: MODELS.sam, raw: undefined };
  } catch {
    return { ok: false, error: 'sam_parse_failed' };
  }
}

// Best-effort box extraction across plausible Responses payload shapes.
function extractBoxes(json) {
  const out = [];
  const texts = [];
  (function walk(v) {
    if (typeof v === 'string') {
      if (v.length < 20000) texts.push(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      if (
        typeof v.x === 'number' && typeof v.y === 'number' &&
        (typeof v.w === 'number' || typeof v.width === 'number') &&
        (typeof v.h === 'number' || typeof v.height === 'number')
      ) {
        out.push({
          label: typeof v.label === 'string' ? v.label : 'zone',
          box: normBox(v),
          confidence: typeof v.confidence === 'number' ? v.confidence : 0.8,
        });
      }
      Object.values(v).forEach(walk);
    }
  })(json);
  // Inline grammar fallback: [x1,y1,x2,y2] triples in 0..1000 space.
  const joined = texts.join('\n');
  const re = /\[\s*(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\s*,\s*(\d{1,4})\s*\]/g;
  const labels = ['stage', 'tables', 'chairs', 'decorations'];
  let m;
  let i = 0;
  while ((m = re.exec(joined)) !== null && out.length < 12) {
    const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
    if (x2 > x1 && y2 > y1 && x1 >= 0 && y1 >= 0 && x2 <= 1000 && y2 <= 1000) {
      out.push({
        label: labels[i % labels.length],
        box: { x: x1 / 1000, y: y1 / 1000, w: (x2 - x1) / 1000, h: (y2 - y1) / 1000 },
        confidence: 0.75,
      });
      i += 1;
    }
  }
  return out.slice(0, 12);
}

function normBox(v) {
  const w = typeof v.w === 'number' ? v.w : v.width;
  const h = typeof v.h === 'number' ? v.h : v.height;
  const div = v.x > 1 || v.y > 1 || w > 1 || h > 1 ? 1000 : 1;
  return { x: v.x / div, y: v.y / div, w: w / div, h: h / div };
}

// --- Muse Image: decoration concept ------------------------------------------
async function imageGenerate({ prompt, size }) {
  const r = await postJson(
    '/images/generations',
    {
      model: MODELS.image,
      prompt,
      size: size || '1024x1024',
      response_format: 'b64_json',
      n: 1,
    },
    { timeoutMs: 60000 }
  );
  if (!r.ok) return r;
  try {
    const item = r.json.data && r.json.data[0];
    if (item && item.b64_json) {
      return { ok: true, b64: item.b64_json, mime: 'image/png', model: MODELS.image };
    }
    if (item && item.url) return { ok: true, url: item.url, model: MODELS.image };
    return { ok: false, error: 'no_image_in_reply' };
  } catch {
    return { ok: false, error: 'image_parse_failed' };
  }
}

// --- Muse Spark: AI venue advisor (Task 05) -------------------------------------
// Owner-facing listing advisor. Stored facts come from hall data, visual
// notes from the selected gallery photos, and everything else is labelled as
// AI suggestions. Never invents facilities and never guarantees bookings.

function advisorName(hall, lang) {
  if (!hall) return '';
  if (typeof hall.name === 'string') return hall.name;
  if (hall.name && typeof hall.name === 'object') {
    return hall.name[lang] || hall.name.fr || hall.name.ar || hall.name.en || '';
  }
  return '';
}

function advisorFacts(hall, photos) {
  const h = hall && typeof hall === 'object' ? hall : {};
  const selected = Array.isArray(photos)
    ? photos.filter((p) => typeof p === 'string' && p).slice(0, 5)
    : [];
  const stored = Array.isArray(h.photos) ? h.photos.filter((p) => typeof p === 'string' && p) : [];
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    name: advisorName(h, 'fr') || String(h.id || ''),
    wilaya: typeof h.wilaya === 'string' ? h.wilaya : '',
    commune: typeof h.commune === 'string' ? h.commune : '',
    capacityMin: num(h.capacityMin),
    capacityMax: num(h.capacityMax),
    priceDzd: num(h.priceDzd),
    styles: Array.isArray(h.styles) ? h.styles.filter((s) => typeof s === 'string') : [],
    amenities: Array.isArray(h.amenities) ? h.amenities.filter((a) => typeof a === 'string') : [],
    photoCount: selected.length,
    totalPhotos: stored.length,
    hasTour: Array.isArray(h.tourScenes) && h.tourScenes.length > 0,
  };
}

function advisorDescLen(hall, lang) {
  const h = hall && typeof hall === 'object' ? hall : {};
  if (typeof h.desc === 'string') return h.desc.trim().length;
  if (h.desc && typeof h.desc === 'object') {
    const s = h.desc[lang] || h.desc.fr || h.desc.ar || h.desc.en || '';
    return String(s).trim().length;
  }
  return 0;
}

function advisorMimeFor(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

// Local gallery uploads live under /uploads/; the model cannot fetch them,
// so they are embedded as base64 data URLs. Remote URLs pass through as-is.
function advisorImagePart(photo) {
  if (typeof photo !== 'string' || !photo) return null;
  if (/^https?:\/\//i.test(photo)) {
    return { type: 'image_url', image_url: { url: photo } };
  }
  if (!photo.startsWith('/uploads/')) return null;
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const filePath = path.join(publicDir, photo);
    if (!filePath.startsWith(publicDir + path.sep)) return null;
    const data = fs.readFileSync(filePath);
    if (!data.length || data.length > 4 * 1024 * 1024) return null;
    const mime = advisorMimeFor(filePath);
    return { type: 'image_url', image_url: { url: `data:${mime};base64,${data.toString('base64')}` } };
  } catch {
    return null;
  }
}

async function sparkAdvisor(hall, facts, selectedPhotos, lang) {
  const langName = lang === 'ar' ? 'Arabic' : lang === 'en' ? 'English' : 'French';
  const sys =
    `You are an honest venue-listing advisor for Algerian wedding halls. ` +
    `Use ONLY the provided hall facts and the attached gallery photographs (never invent facilities, prices, capacities, bookings, or guarantees; ` +
    `the owner stays in full control and must approve every change, so phrase advice as suggestions, never promises). ` +
    `Ground galleryObservations in what you actually see in the photos (lighting, table layout, décor condition) and keep ` +
    `stored hall facts, image observations, and AI suggestions clearly separated. ` +
    `Write every string in ${langName}. Keep internal reasoning minimal and output strict JSON immediately: ` +
    `{"strengths":["..."],"galleryObservations":["..."],"recommendedViews":["..."],"listingImprovements":["..."],"presentationTips":["..."],"nextActions":["..."]}. ` +
    `Each array must hold 2 to 5 concise, realistic, actionable strings. No markdown, no extra text.`;
  const photos = Array.isArray(selectedPhotos)
    ? selectedPhotos.filter((p) => typeof p === 'string' && p).slice(0, 5)
    : [];
  const content = [
    {
      type: 'text',
      text: `Hall structured facts:\n${JSON.stringify(facts)}\n` +
        `Photo URLs under review: ${JSON.stringify(photos)}\n` +
        `Evaluate the following gallery photographs in detail:`,
    },
  ];
  for (const p of photos) {
    const part = advisorImagePart(p);
    if (part) content.push(part);
  }
  const r = await postJson(
    '/chat/completions',
    {
      model: MODELS.spark,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    },
    { timeoutMs: 45000 }
  );
  if (!r.ok) return r;
  try {
    const content = r.json.choices && r.json.choices[0] && r.json.choices[0].message
      ? String(r.json.choices[0].message.content || '')
      : '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start < 0 || end <= start) return { ok: false, error: 'no_json_in_reply' };
    const parsed = JSON.parse(content.slice(start, end + 1));
    const keys = ['strengths', 'galleryObservations', 'recommendedViews', 'listingImprovements', 'presentationTips', 'nextActions'];
    const report = {};
    for (const k of keys) {
      if (!Array.isArray(parsed[k]) || !parsed[k].length) return { ok: false, error: 'bad_advisor_shape' };
      const items = parsed[k]
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim().slice(0, 400));
      if (!items.length) return { ok: false, error: 'bad_advisor_shape' };
      report[k] = items.slice(0, 8);
    }
    return { ok: true, report };
  } catch {
    return { ok: false, error: 'advisor_parse_failed' };
  }
}

const ADVISOR_NOTES = {
  fr: 'Rapport de démonstration (Muse Spark non connecté).',
  ar: 'تقرير تجريبي (Muse Spark غير متصل).',
  en: 'Demo report (Muse Spark not connected).',
};

// Deterministic cached demo report, grounded in the hall's real data.
// Cached mode cannot see photo pixels, so gallery notes stay honest: they
// reference the photo count on file and give checklists, never invented
// visual claims. Suggestions never promise bookings.
function cachedVenueAdvisor(hallData, photos, lang) {
  const h = hallData && typeof hallData === 'object' ? hallData : {};
  const langCode = lang === 'ar' || lang === 'en' ? lang : 'fr';
  const facts = advisorFacts(h, photos);
  const capMin = facts.capacityMin != null ? facts.capacityMin : '?';
  const capMax = facts.capacityMax != null ? facts.capacityMax : '?';
  const price = facts.priceDzd != null ? facts.priceDzd : '?';
  const styles = facts.styles.length ? facts.styles.join(', ') : '—';
  const amenities = facts.amenities;
  const has = (a) => amenities.includes(a);
  const missingCommon = ['parking', 'clim', 'sono'].filter((a) => !has(a));
  const descLen = advisorDescLen(h, langCode);
  const size = facts.capacityMax != null && facts.capacityMax >= 600
    ? 'large'
    : facts.capacityMax != null && facts.capacityMax <= 350 ? 'intimate' : 'medium';

  if (langCode === 'ar') {
    const sizeNote = size === 'large'
      ? `قدرة استيعاب كبيرة: ${capMin}–${capMax} ضيف، مناسبة للأعراس الكبرى.`
      : size === 'intimate'
        ? `قدرة استيعاب ${capMin}–${capMax} ضيف، مثالية للحفلات العائلية الحميمة.`
        : `قدرة استيعاب ${capMin}–${capMax} ضيف، توازن جيد لمعظم الأعراس.`;
    const strengths = [
      sizeNote,
      `الموقع: ${facts.commune || '—'} (ولاية ${facts.wilaya || '—'})، الأنماط المسجلة: ${styles}.`,
      amenities.length
        ? `عدد المرافق المسجلة: ${amenities.length} (${amenities.slice(0, 4).join('، ')})، والسعر المعلن ${price} دج.`
        : `السعر المعلن ${price} دج. أكملوا قائمة المرافق لتعزيز الثقة.`,
    ];
    if (facts.hasTour) strengths.push('جولة 360° متوفرة: ميزة حقيقية لطمأنة العرسان عن بعد.');
    const galleryObservations = [
      `المعرض قيد المراجعة: ${facts.photoCount} صور مختارة من أصل ${facts.totalPhotos} مسجلة.`,
    ];
    if (facts.totalPhotos < 3) {
      galleryObservations.push(`المعرض محدود (${facts.totalPhotos} صور): البطاقات التي تعرض 5 صور أو أكثر تبعث ثقة أكبر.`);
    } else {
      galleryObservations.push('تحققوا أن الصورة الأولى تُظهر القاعة في وضعية الحفل (إضاءة دافئة وطاولات مجهزة).');
    }
    galleryObservations.push('اعتمدوا صوراً حديثة ومتناسقة الألوان، وتجنبوا الفلاتر المبالغ فيها.');
    const recommendedViews = [
      'القاعة في وضعية الحفل، من الخلف باتجاه المسرح.',
      'المدخل الخارجي ليلاً مضاءً.',
      'صالون تجهيز العروس (إن وُجد فعلاً).',
    ];
    if (has('cuisine')) recommendedViews.push('فضاء الإطعام والتحضير، لطمأنة الزبائن على التنظيم.');
    else recommendedViews.push('منطقة خدمة الإطعام، إن كانت القاعة تتوفر عليها فعلاً.');
    if (has('jardin') || facts.styles.includes('exterieur')) recommendedViews.push('الحديقة أو الفضاء الخارجي وقت الغروب.');
    if (has('hebergement')) recommendedViews.push('غرفة أو جناح مخصص للعروسين.');
    const listingImprovements = [
      descLen < 80
        ? `أغنوا الوصف (حالياً ${descLen} حرفاً): الوصول، القدرة حسب التشكيل، والخدمات المشمولة.`
        : `الوصف الحالي (${descLen} حرفاً) بداية جيدة: أضيفوا السياسات (العربون، الإلغاء، الأوقات).`,
      `اعرضوا السعر بوضوح (${price} دج) وما يشمله: حددوا العربون والإضافات المحتملة.`,
    ];
    if (missingCommon.length) {
      listingImprovements.push(`${missingCommon.join('، ')} غير مسجلة في الملف: أضيفوها فقط إن كانت متوفرة فعلاً.`);
    }
    listingImprovements.push(`حددوا الأنماط المقترحة (${styles}) مع مثال زينة لكل منها.`);
    if (!facts.hasTour) listingImprovements.push('أضيفوا جولة 360° أو فيديو قصيراً: العرسان يقارنون عن بعد.');
    const presentationTips = [
      'إضاءة بيضاء دافئة (حوالي 3000K) لأجواء أنيقة في الصور ويوم الزفاف.',
      'ممر مركزي واضح وقوس مزهر لموكب يليق بالصور.',
    ];
    if (facts.styles.includes('oriental')) presentationTips.push('أبرزوا الزليج والفوانيس والثريات لإبراز الطابع الشرقي.');
    if (facts.styles.includes('traditionnel')) presentationTips.push('أبرزوا الزرابي والوسائد المطرزة والنحاسيات لإبراز الأصالة.');
    if (facts.styles.includes('exterieur')) presentationTips.push('جهزوا خطة بديلة بخيمة عند الرياح وإضاءة شمسية للممرات.');
    if (!facts.styles.includes('oriental') && !facts.styles.includes('traditionnel') && !facts.styles.includes('exterieur')) {
      presentationTips.push('خطوط نظيفة وتنسيقات زهرية منخفضة حتى لا تحجب الرؤية بين الضيوف.');
    }
    presentationTips.push('زهور موسمية محلية لمراكز الطاولات: نضارة وميزانية مضبوطة.');
    const nextActions = [
      'اختاروا 3 إلى 5 صور تمثيلية وأعيدوا التحليل بعد كل تحديث.',
      'أكملوا المرافق المتوفرة فعلاً في البطاقة.',
      'أضيفوا سياسات العربون والإلغاء كتابةً.',
      'برمجوا جلسة تصوير بوضعية الحفل قبل الموسم.',
    ];
    return { strengths, galleryObservations, recommendedViews, listingImprovements, presentationTips, nextActions };
  }

  if (langCode === 'en') {
    const sizeNote = size === 'large'
      ? `Large capacity: ${capMin}-${capMax} guests, suited to grand weddings.`
      : size === 'intimate'
        ? `Capacity of ${capMin}-${capMax} guests, ideal for intimate family celebrations.`
        : `Capacity of ${capMin}-${capMax} guests, a good balance for most weddings.`;
    const strengths = [
      sizeNote,
      `Location: ${facts.commune || '—'} (wilaya ${facts.wilaya || '—'}), listed styles: ${styles}.`,
      amenities.length
        ? `${amenities.length} amenities on file (${amenities.slice(0, 4).join(', ')}), listed price ${price} DZD.`
        : `Listed price ${price} DZD. Complete the amenities list to build trust.`,
    ];
    if (facts.hasTour) strengths.push('360° tour available: a genuine asset to reassure couples from afar.');
    const galleryObservations = [
      `Gallery under review: ${facts.photoCount} selected photo(s) out of ${facts.totalPhotos} on file.`,
    ];
    if (facts.totalPhotos < 3) {
      galleryObservations.push(`Small gallery (${facts.totalPhotos} photos): listings with 5 or more photos inspire more trust.`);
    } else {
      galleryObservations.push('Check that the first photo shows the hall dressed for a celebration (warm lighting, set tables).');
    }
    galleryObservations.push('Use recent photos with consistent tones and avoid heavy filters.');
    const recommendedViews = [
      'The hall dressed for a ceremony, seen from the back toward the stage.',
      'The outdoor entrance at night, lit up.',
      'The bride dressing room (only if one genuinely exists).',
    ];
    if (has('cuisine')) recommendedViews.push('The catering / prep area, to reassure clients about logistics.');
    else recommendedViews.push('The catering service area, if the hall genuinely has one.');
    if (has('jardin') || facts.styles.includes('exterieur')) recommendedViews.push('The garden or outdoor space at golden hour.');
    if (has('hebergement')) recommendedViews.push('A room or suite set aside for the couple.');
    const listingImprovements = [
      descLen < 80
        ? `Expand the description (currently ${descLen} characters): access, capacity per layout, included services.`
        : `Your description (${descLen} characters) is a good start: add policies (deposit, cancellation, hours).`,
      `Show the price clearly (${price} DZD) and what it includes: state the deposit and possible extras.`,
    ];
    if (missingCommon.length) {
      listingImprovements.push(`${missingCommon.join(', ')} ${missingCommon.length > 1 ? 'are' : 'is'} not on file: only add ${missingCommon.length > 1 ? 'them' : 'it'} if genuinely available.`);
    }
    listingImprovements.push(`Detail the offered styles (${styles}) with a décor example for each.`);
    if (!facts.hasTour) listingImprovements.push('Add a 360° tour or a short video: couples compare venues remotely.');
    const presentationTips = [
      'Warm-white lighting (around 3000K) for an elegant mood in photos and on the day.',
      'A clear central aisle and a floral arch for a photogenic procession.',
    ];
    if (facts.styles.includes('oriental')) presentationTips.push('Highlight zellige, lanterns and chandeliers to showcase the oriental character.');
    if (facts.styles.includes('traditionnel')) presentationTips.push('Highlight rugs, embroidered cushions and copperware to showcase authenticity.');
    if (facts.styles.includes('exterieur')) presentationTips.push('Prepare a marquee backup plan for wind and solar path lighting.');
    if (!facts.styles.includes('oriental') && !facts.styles.includes('traditionnel') && !facts.styles.includes('exterieur')) {
      presentationTips.push('Clean lines and low floral arrangements so guests can see each other.');
    }
    presentationTips.push('Local seasonal flowers for centrepieces: freshness on a controlled budget.');
    const nextActions = [
      'Select 3 to 5 representative photos and re-run the analysis after each update.',
      'Complete the genuinely available amenities on the listing.',
      'Publish your deposit and cancellation policies in writing.',
      'Schedule a dressed-for-celebration photo shoot before peak season.',
    ];
    return { strengths, galleryObservations, recommendedViews, listingImprovements, presentationTips, nextActions };
  }

  const sizeNote = size === 'large'
    ? `Grande capacité d'accueil : ${capMin}–${capMax} invités, adaptée aux grands mariages.`
    : size === 'intimate'
      ? `Capacité de ${capMin}–${capMax} invités, idéale pour les fêtes familiales intimistes.`
      : `Capacité de ${capMin}–${capMax} invités, un bon équilibre pour la plupart des mariages.`;
  const strengths = [
    sizeNote,
    `Emplacement : ${facts.commune || '—'} (wilaya ${facts.wilaya || '—'}), styles renseignés : ${styles}.`,
    amenities.length
      ? `${amenities.length} équipements au dossier (${amenities.slice(0, 4).join(', ')}), tarif affiché de ${price} DA.`
      : `Tarif affiché de ${price} DA. Complétez la liste des équipements pour inspirer confiance.`,
  ];
  if (facts.hasTour) strengths.push('Visite 360° disponible : un vrai atout pour rassurer les couples à distance.');
  const galleryObservations = [
    `Galerie analysée : ${facts.photoCount} photo(s) sélectionnée(s) sur ${facts.totalPhotos} au dossier.`,
  ];
  if (facts.totalPhotos < 3) {
    galleryObservations.push(`Galerie réduite (${facts.totalPhotos} photos) : les fiches avec 5 photos ou plus inspirent davantage confiance.`);
  } else {
    galleryObservations.push('Vérifiez que la première photo montre la salle en configuration de fête (éclairage chaleureux, tables dressées).');
  }
  galleryObservations.push('Privilégiez des photos récentes aux tons cohérents, sans filtres excessifs.');
  const recommendedViews = [
    'La salle en configuration de cérémonie, vue depuis le fond vers la scène.',
    'L’entrée extérieure de nuit, illuminée.',
    'Le salon de préparation de la mariée (uniquement s’il existe réellement).',
  ];
  if (has('cuisine')) recommendedViews.push('L’espace traiteur / préparation, pour rassurer sur l’organisation.');
  else recommendedViews.push('La zone de service traiteur, si la salle en dispose réellement.');
  if (has('jardin') || facts.styles.includes('exterieur')) recommendedViews.push('Le jardin ou l’espace extérieur à l’heure dorée.');
  if (has('hebergement')) recommendedViews.push('Une chambre ou suite réservée aux mariés.');
  const listingImprovements = [
    descLen < 80
      ? `Enrichissez la description (actuellement ${descLen} caractères) : accès, capacité par configuration, services inclus.`
      : `Votre description (${descLen} caractères) est un bon début : ajoutez les politiques (acompte, annulation, horaires).`,
    `Affichez clairement le tarif (${price} DA) et ce qu’il inclut : précisez l’acompte et les suppléments éventuels.`,
  ];
  if (missingCommon.length) {
    listingImprovements.push(`${missingCommon.join(', ')} ne ${missingCommon.length > 1 ? 'figurent' : 'figure'} pas au dossier : ajoutez-${missingCommon.length > 1 ? 'les' : 'le'} uniquement s’ils sont réellement disponibles.`);
  }
  listingImprovements.push(`Détaillez les styles proposés (${styles}) avec un exemple de décoration pour chacun.`);
  if (!facts.hasTour) listingImprovements.push('Ajoutez une visite 360° ou une courte vidéo : les couples comparent à distance.');
  const presentationTips = [
    'Éclairage blanc chaud (environ 3000K) pour une ambiance élégante sur les photos comme le jour J.',
    'Allée centrale dégagée et arche fleurie pour un cortège photogénique.',
  ];
  if (facts.styles.includes('oriental')) presentationTips.push('Valorisez les zelliges, lanternes et lustres pour affirmer le caractère oriental.');
  if (facts.styles.includes('traditionnel')) presentationTips.push('Valorisez les tapis, coussins brodés et cuivres pour affirmer l’authenticité.');
  if (facts.styles.includes('exterieur')) presentationTips.push('Prévoyez un plan B chapiteau en cas de vent et un éclairage solaire des allées.');
  if (!facts.styles.includes('oriental') && !facts.styles.includes('traditionnel') && !facts.styles.includes('exterieur')) {
    presentationTips.push('Lignes épurées et compositions florales basses pour ne pas couper la vue entre invités.');
  }
  presentationTips.push('Fleurs de saison locales pour les centres de table : fraîcheur et budget maîtrisé.');
  const nextActions = [
    'Sélectionnez 3 à 5 photos représentatives et relancez l’analyse après chaque mise à jour.',
    'Complétez dans la fiche les équipements réellement disponibles.',
    'Publiez par écrit vos politiques d’acompte et d’annulation.',
    'Planifiez une séance photo en configuration de fête avant la haute saison.',
  ];
  return { strengths, galleryObservations, recommendedViews, listingImprovements, presentationTips, nextActions };
}

async function venueAdvisor(hallData, photos, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const lang = options.lang === 'ar' || options.lang === 'en' ? options.lang : 'fr';
  const facts = advisorFacts(hallData, photos);
  const selectedPhotos = Array.isArray(photos)
    ? photos.filter((p) => typeof p === 'string' && p).slice(0, 5)
    : [];
  if (isConfigured()) {
    try {
      const live = await sparkAdvisor(hallData, facts, selectedPhotos, lang);
      if (live.ok) return { ok: true, mode: 'live', model: MODELS.spark, report: live.report };
    } catch {
      // Fall through to the cached demo report below.
    }
  }
  return {
    ok: true,
    mode: 'cached',
    model: 'walimapp-venue-advisor-1',
    report: cachedVenueAdvisor(hallData, photos, lang),
    note: ADVISOR_NOTES[lang],
  };
}

module.exports = { MODELS, META_BASE, isConfigured, sparkRank, samSegment, imageGenerate, venueAdvisor, cachedVenueAdvisor, advisorFacts };
