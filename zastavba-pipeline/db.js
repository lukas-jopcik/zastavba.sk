import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.app') ? { rejectUnauthorized: false } : false,
});

export async function upsertItem(row) {
  const q = `
  INSERT INTO eia_items (
    source, type, title, date, listed_date, region, municipality, okres, phase, cpv, buyer, value,
    detail_url, source_url, has_pdf, raw_text_snippet, fetched_at,
    purpose, process_type, obstaravatel, obstaravatel_ico, dotknuta_obec, prislusny_organ, legal_basis, snippet,
    municipality_norm, okres_norm, region_norm, lat, lon, geocode_confidence, last_seen
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
    $13,$14,$15,$16,$17,
    $18,$19,$20,$21,$22,$23,$24,$25,
    $26,$27,$28,$29,$30,$31, now()
  )
  ON CONFLICT (detail_url) DO UPDATE SET
    title=EXCLUDED.title,
    date=EXCLUDED.date,
    listed_date=EXCLUDED.listed_date,
    region=EXCLUDED.region,
    municipality=EXCLUDED.municipality,
    okres=EXCLUDED.okres,
    phase=EXCLUDED.phase,
    cpv=EXCLUDED.cpv,
    buyer=EXCLUDED.buyer,
    value=EXCLUDED.value,
    source_url=EXCLUDED.source_url,
    has_pdf=EXCLUDED.has_pdf,
    raw_text_snippet=COALESCE(EXCLUDED.raw_text_snippet, eia_items.raw_text_snippet),
    fetched_at=EXCLUDED.fetched_at,
    purpose=COALESCE(EXCLUDED.purpose, eia_items.purpose),
    process_type=COALESCE(EXCLUDED.process_type, eia_items.process_type),
    obstaravatel=COALESCE(EXCLUDED.obstaravatel, eia_items.obstaravatel),
    obstaravatel_ico=COALESCE(EXCLUDED.obstaravatel_ico, eia_items.obstaravatel_ico),
    dotknuta_obec=COALESCE(EXCLUDED.dotknuta_obec, eia_items.dotknuta_obec),
    prislusny_organ=COALESCE(EXCLUDED.prislusny_organ, eia_items.prislusny_organ),
    legal_basis=COALESCE(EXCLUDED.legal_basis, eia_items.legal_basis),
    snippet=COALESCE(EXCLUDED.snippet, eia_items.snippet),
    municipality_norm=COALESCE(EXCLUDED.municipality_norm, eia_items.municipality_norm),
    okres_norm=COALESCE(EXCLUDED.okres_norm, eia_items.okres_norm),
    region_norm=COALESCE(EXCLUDED.region_norm, eia_items.region_norm),
    lat=COALESCE(EXCLUDED.lat, eia_items.lat),
    lon=COALESCE(EXCLUDED.lon, eia_items.lon),
    geocode_confidence=COALESCE(EXCLUDED.geocode_confidence, eia_items.geocode_confidence),
    last_seen=now()
  `;
  const vals = [
    row.source, row.type, row.title, row.date, row.listed_date, row.region, row.municipality, row.okres, row.phase,
    row.cpv || null, row.buyer, row.value, row.detail_url, row.source_url, row.has_pdf, row.raw_text_snippet, row.fetched_at,
    row.purpose, row.process_type, row.obstaravatel, row.obstaravatel_ico, row.dotknuta_obec, row.prislusny_organ, row.legal_basis, row.snippet,
    row.municipality_norm, row.okres_norm, row.region_norm, row.lat, row.lon, row.geocode_confidence
  ];
  await pool.query(q, vals);
}
