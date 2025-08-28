import fetch from 'node-fetch';

function norm(s) {
  return (s || '').toString().replace(/\s+/g, ' ').trim();
}

async function geocode({ municipality, okres, region }) {
  if (!municipality && !okres && !region) return {};
  const q = [municipality, okres, region, 'Slovensko'].filter(Boolean).join(', ');
  const url = `${process.env.GEOCODER_BASE}?format=jsonv2&q=${encodeURIComponent(q)}&limit=1${process.env.GEOCODER_EMAIL ? `&email=${encodeURIComponent(process.env.GEOCODER_EMAIL)}` : ''}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'enviroportal-pipeline/1.0' } });
  if (!res.ok) return {};
  const arr = await res.json();
  if (!arr?.length) return {};
  return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon), geocode_confidence: arr[0].type || null };
}

export async function normalizeAndGeocode(rows) {
  const cache = new Map();
  for (const r of rows) {
    r.municipality_norm = norm(r.municipality);
    r.okres_norm = norm(r.okres);
    r.region_norm = norm(r.region);

    const key = `${r.municipality_norm}|${r.okres_norm}|${r.region_norm}`;
    if (!cache.has(key)) {
      const geo = await geocode({ municipality: r.municipality_norm, okres: r.okres_norm, region: r.region_norm }).catch(()=> ({}));
      cache.set(key, geo);
      await new Promise(res => setTimeout(res, 900)); // šetrná kadencia
    }
    const { lat, lon, geocode_confidence } = cache.get(key) || {};
    r.lat = lat ?? null;
    r.lon = lon ?? null;
    r.geocode_confidence = geocode_confidence ?? null;
  }
  return rows;
}
