// geocode_locations.js
/* Usage:
   node geocode_locations.js data_enriched/2025-08-28_eia_enriched.json
   node geocode_locations.js data_enriched/2025-08-28_sea_enriched.json
*/
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const INPUT = process.argv[2];
if (!INPUT) {
  console.error('❌ Missing input JSON.\n   Example: node geocode_locations.js data_enriched/2025-08-28_eia_enriched.json');
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), 'data_enriched');
const CACHE_DIR = path.join(process.cwd(), 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'geocode_cache.json');

const provider = process.env.GEOCODE_PROVIDER || 'nominatim';
const email = process.env.GEOCODE_EMAIL || '';

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJSONLike(inputPath, arr, suffix) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.basename(inputPath).replace(/\.json$/i, '');
  const out = path.join(OUT_DIR, `${base}${suffix}.json`);
  fs.writeFileSync(out, JSON.stringify(arr, null, 2), 'utf8');
  console.log(`💾 Saved ${arr.length} → ${out}`);
}
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function loadCache() {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch { return {}; }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function buildQuery(r) {
  // preferuj najpresnejšie info
  const parts = [];
  const m = (r.municipality || r.dotknuta_obec || '').toString().trim();
  const o = (r.okres || '').toString().trim();
  const reg = (r.region || '').toString().trim();
  if (m) parts.push(m);
  if (o) parts.push(o);
  if (reg) parts.push(reg);
  parts.push('Slovakia');
  return parts.filter(Boolean).join(', ');
}

async function geocodeNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const headers = {
    'User-Agent': email ? `enviro-scraper/1.0 (${email})` : 'enviro-scraper/1.0',
    'Accept': 'application/json',
  };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    precision: hit.type || null,
    source: 'nominatim',
  };
}

async function geocodeOne(query) {
  if (!query) return null;
  if (provider === 'nominatim') return geocodeNominatim(query);
  throw new Error(`Unsupported GEOCODE_PROVIDER: ${provider}`);
}

(async () => {
  const arr = loadJSON(INPUT);
  console.log(`🗺️  Geocoding: ${INPUT} (${arr.length} records)`);

  const cache = loadCache();
  let done = 0;
  const out = [];

  for (const r of arr) {
    const q = buildQuery(r);
    let geo = null;

    if (q && cache[q]) {
      geo = cache[q];
    } else if (q) {
      try {
        geo = await geocodeOne(q);
        cache[q] = geo || { lat:null, lng:null, precision:null, source:null };
        saveCache(cache);
        await sleep(1100); // ~1 req/s kvôli Nominatim
      } catch (e) {
        console.warn('   ! geocode error:', q, e.message);
      }
    }

    out.push({
      ...r,
      geo_lat: geo?.lat ?? null,
      geo_lng: geo?.lng ?? null,
      geo_precision: geo?.precision ?? null,
      geo_source: geo?.source ?? (geo ? 'nominatim' : null),
    });

    done++;
    if (done % 25 === 0 || done === arr.length) {
      console.log(`   → progress ${done}/${arr.length}`);
      // priebežné uloženie
      saveJSONLike(INPUT, out, '_geo_partial');
    }
  }

  saveJSONLike(INPUT, out, '_geo');
  console.log('✅ Geocode done.');
})();
