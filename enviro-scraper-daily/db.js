// db.js
const { Pool } = require('pg');
require('dotenv').config();

const { DATABASE_URL } = process.env;

function cfgFromUrl(urlStr) {
  const u = new URL(urlStr);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username),
    password: String(decodeURIComponent(u.password || '')),
    database: u.pathname.replace(/^\//, ''),
    // 👇 dôležité pre Railway self-signed SSL
    ssl: { rejectUnauthorized: false },
  };
}

const pool = new Pool(cfgFromUrl(DATABASE_URL));

async function upsertItem(item) {
  const q = `
    INSERT INTO enviro_items
      (detail_url, title, authority, region, district, municipality,
       listed_date, type, raw_json, enriched_json, geom)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       CASE WHEN $11 IS NOT NULL
            THEN ST_SetSRID(ST_GeomFromGeoJSON($11),4326)
            ELSE NULL END)
    ON CONFLICT (detail_url) DO UPDATE SET
      title = EXCLUDED.title,
      authority = EXCLUDED.authority,
      region = EXCLUDED.region,
      district = EXCLUDED.district,
      municipality = EXCLUDED.municipality,
      listed_date = EXCLUDED.listed_date,
      type = EXCLUDED.type,
      raw_json = EXCLUDED.raw_json,
      enriched_json = EXCLUDED.enriched_json,
      geom = EXCLUDED.geom;
  `;

  const values = [
    item.detail_url,
    item.title,
    item.authority,
    item.region,
    item.district,
    item.municipality,
    item.listed_date,
    item.type,
    item.raw_json ? JSON.stringify(item.raw_json) : null,
    item.enriched_json ? JSON.stringify(item.enriched_json) : null,
    item.geom ? JSON.stringify(item.geom) : null,
  ];

  await pool.query(q, values);
}

// Helper na kontrolu existujúcich URL
async function getExistingDetailUrls(urls) {
  if (!urls || urls.length === 0) return new Set();
  const q = `SELECT detail_url FROM enviro_items WHERE detail_url = ANY($1::text[])`;
  const res = await pool.query(q, [urls]);
  return new Set(res.rows.map(r => r.detail_url));
}

module.exports = {
  upsertItem,
  getExistingDetailUrls,
};
