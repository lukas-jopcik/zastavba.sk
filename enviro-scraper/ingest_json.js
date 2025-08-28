// ingest_json.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Usage: node ingest_json.js <file or glob>');
  process.exit(1);
}

// Jednoduché "glob" rozšírenie bez závislostí
function expandArg(pat) {
  if (!pat.includes('*')) return [pat];
  const dir = path.dirname(pat);
  const base = path.basename(pat).replace(/\./g, '\\.').replace(/\*/g, '.*');
  const re = new RegExp(`^${base}$`);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(fn => re.test(fn))
    .map(fn => path.join(dir, fn));
}

async function ingestOne(file) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(json) ? json : [];

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const sql = `
    INSERT INTO public.enviro_records (
      source, type, title, date, listed_date, region, municipality, okres, phase, cpv,
      buyer, value, detail_url, source_url, has_pdf, raw_text_snippet, fetched_at,
      purpose, process_type, obstaravatel, obstaravatel_ico, dotknuta_obec,
      prislusny_organ, legal_basis, snippet, geom, detail_pairs, created_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,
      $18,$19,$20,$21,$22,
      $23,$24,$25, ST_SetSRID(ST_MakePoint($26, $27), 4326), $28, NOW()
    )
    ON CONFLICT (detail_url) DO UPDATE SET
      title = EXCLUDED.title,
      date = EXCLUDED.date,
      listed_date = EXCLUDED.listed_date,
      region = EXCLUDED.region,
      municipality = EXCLUDED.municipality,
      okres = EXCLUDED.okres,
      purpose = EXCLUDED.purpose,
      process_type = EXCLUDED.process_type,
      obstaravatel = EXCLUDED.obstaravatel,
      obstaravatel_ico = EXCLUDED.obstaravatel_ico,
      dotknuta_obec = EXCLUDED.dotknuta_obec,
      prislusny_organ = EXCLUDED.prislusny_organ,
      legal_basis = EXCLUDED.legal_basis,
      snippet = EXCLUDED.snippet,
      raw_text_snippet = EXCLUDED.raw_text_snippet,
      fetched_at = EXCLUDED.fetched_at,
      detail_pairs = EXCLUDED.detail_pairs
  `;

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const lon = (r.lon ?? r.lng ?? null);
      const lat = (r.lat ?? null);

      await client.query(sql, [
        r.source ?? null,
        r.type ?? null,
        r.title ?? null,
        r.date ?? null,
        r.listed_date ?? null,
        r.region ?? null,
        r.municipality ?? null,
        r.okres ?? null,
        r.phase ?? null,
        r.cpv ?? [],
        r.buyer ?? null,
        r.value ?? null,
        r.detail_url ?? null,
        r.source_url ?? null,
        !!r.has_pdf,
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
        lon, // x
        lat, // y
        JSON.stringify(r.detail_pairs ?? []),
      ]);
      ok++;
    } catch (e) {
      fail++;
      console.warn('Insert failed for:', r.detail_url, e.message);
    }
  }

  await client.end();
  console.log(`💾 Ingest ${path.basename(file)} → OK: ${ok}, FAIL: ${fail}`);
}

(async () => {
  const files = expandArg(inputArg).filter(f => fs.existsSync(f));
  if (files.length === 0) {
    console.error(`No matching files to ingest for: ${inputArg}`);
    process.exit(1);
  }
  for (const f of files) {
    await ingestOne(f);
  }
})();
