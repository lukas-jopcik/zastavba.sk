// ingest_json.js (enviro_items-compliant)
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const { DATABASE_URL, PGSSL, WRITE_DB } = process.env;

if (!DATABASE_URL) {
  console.error('❌ Missing env DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: PGSSL === '1' ? { rejectUnauthorized: false } : false,
});

// --- tiny glob expander (supports single * in filename) -----------
function expandPaths(pattern) {
  if (!pattern.includes('*')) return fs.existsSync(pattern) ? [pattern] : [];
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const esc = s => s.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp('^' + esc(base).replace(/\\\*/g, '.*') + '$');
  try {
    return fs.readdirSync(dir).filter(f => re.test(f)).map(f => path.join(dir, f));
  } catch {
    return [];
  }
}
const uniq = arr => Array.from(new Set(arr));
const bool = v => (v == null ? null : ['1','true','yes','y'].includes(String(v).toLowerCase()));
const toJsonb = v => (v == null ? null : JSON.stringify(v));
const toNumeric = v => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/\s+/g,'').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

async function upsert(client, r) {
  const sql = `
INSERT INTO enviro_items (
  source, type, title, date, listed_date,
  region, municipality, okres, phase,
  cpv, buyer, value,
  detail_url, source_url, has_pdf,
  raw_text_snippet, fetched_at,
  purpose, process_type, obstaravatel, obstaravatel_ico,
  dotknuta_obec, prislusny_organ, legal_basis, snippet,
  detail_pairs
) VALUES (
  $1,$2,$3,$4,$5,
  $6,$7,$8,$9,
  $10,$11,$12,
  $13,$14,$15,
  $16,$17,
  $18,$19,$20,$21,
  $22,$23,$24,$25,
  $26
)
ON CONFLICT (detail_url) DO UPDATE SET
  source = EXCLUDED.source,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  date = EXCLUDED.date,
  listed_date = EXCLUDED.listed_date,
  region = EXCLUDED.region,
  municipality = EXCLUDED.municipality,
  okres = EXCLUDED.okres,
  phase = EXCLUDED.phase,
  cpv = EXCLUDED.cpv,
  buyer = EXCLUDED.buyer,
  value = EXCLUDED.value,
  source_url = EXCLUDED.source_url,
  has_pdf = EXCLUDED.has_pdf,
  raw_text_snippet = COALESCE(EXCLUDED.raw_text_snippet, enviro_items.raw_text_snippet),
  fetched_at = EXCLUDED.fetched_at,
  purpose = COALESCE(EXCLUDED.purpose, enviro_items.purpose),
  process_type = COALESCE(EXCLUDED.process_type, enviro_items.process_type),
  obstaravatel = COALESCE(EXCLUDED.obstaravatel, enviro_items.obstaravatel),
  obstaravatel_ico = COALESCE(EXCLUDED.obstaravatel_ico, enviro_items.obstaravatel_ico),
  dotknuta_obec = COALESCE(EXCLUDED.dotknuta_obec, enviro_items.dotknuta_obec),
  prislusny_organ = COALESCE(EXCLUDED.prislusny_organ, enviro_items.prislusny_organ),
  legal_basis = COALESCE(EXCLUDED.legal_basis, enviro_items.legal_basis),
  snippet = COALESCE(EXCLUDED.snippet, enviro_items.snippet),
  detail_pairs = COALESCE(EXCLUDED.detail_pairs, enviro_items.detail_pairs)
;`;

  const vals = [
    r.source ?? null,
    r.type ?? null,
    r.title ?? null,
    r.date ?? null,
    r.listed_date ?? null,
    r.region ?? null,
    r.municipality ?? null,
    r.okres ?? null,
    r.phase ?? null,
    toJsonb(r.cpv ?? null),
    r.buyer ?? null,
    toNumeric(r.value),
    r.detail_url ?? null,
    r.source_url ?? null,
    bool(r.has_pdf),
    r.raw_text_snippet ?? null,
    r.fetched_at ?? null,
    r.purpose ?? null,
    r.process_type ?? null,
    r.obstaravatel ?? null,
    r.obstaravatel_ico ?? null,
    r.dotknuta_obec ?? null,
    r.prislusny_organ ?? null,
    r.legal_basis ?? null,
    r.snippet ?? null,
    toJsonb(r.detail_pairs ?? null),
  ];

  await client.query(sql, vals);
}

async function main() {
  const args = process.argv.slice(2);
  let files = [];
  for (const a of args) files.push(...expandPaths(a));
  files = uniq(files);
  if (!files.length) {
    console.error('❌ No input files found.');
    process.exit(1);
  }
  console.log('📦 Files to ingest:', files);

  const client = await pool.connect();
  try {
    if (WRITE_DB !== '1') {
      console.warn('⚠️ WRITE_DB != 1 → dry-run. Set WRITE_DB=1 to enable inserts.');
    }

    let total = 0;
    for (const file of files) {
      const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log(`→ ${path.basename(file)}: ${arr.length} records`);
      if (WRITE_DB !== '1') { total += arr.length; continue; }

      await client.query('BEGIN');
      let i = 0;
      for (const rec of arr) {
        await upsert(client, rec);
        i++;
        if (i % 100 === 0) process.stdout.write(`   ${i}/${arr.length}\r`);
      }
      await client.query('COMMIT');
      console.log(`   ✅ committed ${arr.length}`);
      total += arr.length;
    }
    console.log(`✅ Done. Ingested ${total} record(s).`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ Ingest error:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
