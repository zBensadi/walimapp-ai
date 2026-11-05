'use strict';
// WalimApp AI — MariaDB migration + seed runner.
//
// Applies lib/schema.sql and seeds the inquiries table from
// data/inquiries.json when the table is empty. Exits 0 with an informational
// message when MariaDB is not configured, mysql2 is missing, or the database
// is unreachable (the server then uses atomic JSON file mode).
//
// Usage: node lib/migrate.js

const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch { /* best effort */ }
}

async function main() {
  loadDotEnv();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.log('migrate: MariaDB not configured (DB_HOST/DB_USER/DB_NAME) — using JSON file mode.');
    return;
  }
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch {
    console.log('migrate: mysql2 is not installed — using JSON file mode.');
    return;
  }
  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD || '',
    database: DB_NAME,
    port: Number(DB_PORT || 3306),
    connectionLimit: 5,
    connectTimeout: 8000,
  });
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.log(`migrate: cannot reach MariaDB (${err && err.message ? err.message : err}) — using JSON file mode.`);
    try {
      await pool.end();
    } catch { /* best effort */ }
    return;
  }
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log('migrate: schema ready.');

    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM inquiries');
    const count = rows && rows[0] ? Number(rows[0].n) : 0;
    if (count === 0) {
      let seed = [];
      try {
        seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'inquiries.json'), 'utf8'));
        if (!Array.isArray(seed)) seed = [];
      } catch {
        seed = [];
      }
      for (const i of seed) {
        await pool.query(
          'INSERT INTO inquiries (reference, status, hall_id, hall_name, wilaya, name, phone, date, guests, message, consent, consent_at, lang, created_at, owner_note, decided_at, customer_id) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            i.reference,
            i.status || 'pending',
            i.hallId,
            typeof i.hallName === 'string' ? i.hallName : JSON.stringify(i.hallName ?? null),
            i.wilaya,
            i.name,
            i.phone,
            i.date,
            i.guests,
            i.message || '',
            i.consent ? 1 : 0,
            i.consentAt || null,
            i.lang || 'fr',
            i.createdAt,
            i.ownerNote ?? null,
            i.decidedAt ?? null,
            i.customerId ?? null,
          ]
        );
      }
      console.log(`migrate: seeded ${seed.length} inquiries.`);
    } else {
      console.log(`migrate: inquiries table already has ${count} rows, seed skipped.`);
    }

    try {
      const [hrows] = await pool.query('SELECT COUNT(*) AS n FROM halls');
      const hcount = hrows && hrows[0] ? Number(hrows[0].n) : 0;
      if (hcount === 0) {
        let hseed = [];
        try {
          const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'halls.json'), 'utf8'));
          hseed = Array.isArray(parsed) ? parsed : Array.isArray(parsed.halls) ? parsed.halls : [];
        } catch {
          hseed = [];
        }
        for (const h of hseed) {
          if (!h || !h.id) continue;
          const ownerId = h.ownerId || null;
          await pool.query('INSERT IGNORE INTO halls (id, owner_id, payload) VALUES (?, ?, ?)', [
            h.id,
            ownerId,
            JSON.stringify({ ...h, ownerId }),
          ]);
        }
        console.log(`migrate: seeded ${hseed.length} halls.`);
      } else {
        console.log(`migrate: halls table already has ${hcount} rows, seed skipped.`);
      }
    } catch (err) {
      console.log(`migrate: halls seed skipped (${err && err.message ? err.message : err}).`);
    }
  } finally {
    try {
      await pool.end();
    } catch { /* best effort */ }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`migrate: failed — ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
}

module.exports = { main };
