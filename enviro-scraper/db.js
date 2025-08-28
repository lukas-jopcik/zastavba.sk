const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL ? { rejectUnauthorized: false } : false,
});

async function upsertItem(item) {
  const q = `INSERT INTO enviro_items (
    source, type, title, date, listed_date, region, municipality, okres, phase,
    cpv, buyer, value, detail_url, source_url, has_pdf, raw_text_snippet, fetched_at,
    purpose, process_type, obstaravatel, obstaravatel_ico, dotknuta_obec, prislusny_organ,
    legal_basis, snippet, detail_pairs
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,
    $10,$11,$12,$13,$14,$15,$16,$17,
    $18,$19,$20,$21,$22,$23,
    $24,$25,$26
  )
  ON CONFLICT (detail_url) DO UPDATE SET
    title=EXCLUDED.title,
    date=EXCLUDED.date,
    listed_date=EXCLUDED.listed_date,
    region=EXCLUDED.region,
    municipality=EXCLUDED.municipality,
    okres=EXCLUDED.okres,
    purpose=EXCLUDED.purpose,
    process_type=EXCLUDED.process_type,
    obstaravatel=EXCLUDED.obstaravatel,
    obstaravatel_ico=EXCLUDED.obstaravatel_ico,
    dotknuta_obec=EXCLUDED.dotknuta_obec,
    prislusny_organ=EXCLUDED.prislusny_organ,
    legal_basis=EXCLUDED.legal_basis,
    snippet=EXCLUDED.snippet,
    raw_text_snippet=EXCLUDED.raw_text_snippet,
    detail_pairs=EXCLUDED.detail_pairs
  ;`;

  const vals = [
    item.source, item.type, item.title, item.date, item.listed_date, item.region,
    item.municipality, item.okres, item.phase, JSON.stringify(item.cpv||[]), item.buyer,
    item.value, item.detail_url, item.source_url, item.has_pdf, item.raw_text_snippet,
    item.fetched_at, item.purpose, item.process_type, item.obstaravatel,
    item.obstaravatel_ico, item.dotknuta_obec, item.prislusny_organ, item.legal_basis,
    item.snippet, JSON.stringify(item.detail_pairs||[])
  ];
  await pool.query(q, vals);
}

module.exports = { upsertItem };
