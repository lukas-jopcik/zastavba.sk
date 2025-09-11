// run_latest.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
require('dotenv').config();

const { getExistingDetailUrls, closeDb } = require('./db');

function run(cmd, extraEnv = {}) {
  console.log(`\n▶️ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...extraEnv } });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

(async () => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const RAW_DIR = path.join(process.cwd(), 'data_raw');
    const ENR_DIR = path.join(process.cwd(), 'data_enriched');

    // 1) Collect iba prvé stránky (default 10, dá sa prepísať envom)
    const MAX_PAGES = process.env.MAX_PAGES || '10';
    run('node collect_enviroportal_list.js', { MAX_PAGES });

    const eiaRaw = path.join(RAW_DIR, `${today}_eia.json`);
    const seaRaw = path.join(RAW_DIR, `${today}_sea.json`);

    const eiaArr = fs.existsSync(eiaRaw) ? readJSON(eiaRaw) : [];
    const seaArr = fs.existsSync(seaRaw) ? readJSON(seaRaw) : [];

    // 2) Prefiltruj len nové detail_url proti DB
    const all = [...eiaArr, ...seaArr];
    const urls = all.map(r => r.detail_url).filter(Boolean);
    const existing = await getExistingDetailUrls(urls);
    await closeDb(); // dôležité pre krátke cron joby, nech nezostane otvorené spojenie

    const isNew = r => r.detail_url && !existing.has(r.detail_url);

    const eiaNew = eiaArr.filter(isNew);
    const seaNew = seaArr.filter(isNew);

    const eiaNewRaw = path.join(RAW_DIR, `${today}_eia_new.json`);
    const seaNewRaw = path.join(RAW_DIR, `${today}_sea_new.json`);
    writeJSON(eiaNewRaw, eiaNew);
    writeJSON(seaNewRaw, seaNew);

    console.log(`\n📊 New items: EIA=${eiaNew.length}, SEA=${seaNew.length}, TOTAL=${eiaNew.length + seaNew.length}`);

    if ((eiaNew.length + seaNew.length) === 0) {
      console.log('✅ Nothing new. Exiting.');
      process.exit(0);
    }

    // 3) Enrich len nové
    run(`node enrich_eia_details.js ${eiaNewRaw}`);
    run(`node enrich_eia_details.js ${seaNewRaw}`);

    const eiaEnr = path.join(ENR_DIR, `${today}_eia_new_enriched.json`);
    const seaEnr = path.join(ENR_DIR, `${today}_sea_new_enriched.json`);

    // 4) Geocode len nové
    run(`node geocode_locations.js ${eiaEnr}`);
    run(`node geocode_locations.js ${seaEnr}`);

    const eiaGeo = path.join(ENR_DIR, `${today}_eia_new_enriched_geo.json`);
    const seaGeo = path.join(ENR_DIR, `${today}_sea_new_enriched_geo.json`);

    // 5) Ingest do DB (využije existujúci upsert)
    run(`node ingest_json.js ${eiaGeo}`);
    run(`node ingest_json.js ${seaGeo}`);

    console.log('\n✅ Latest pipeline done');
  } catch (e) {
    console.error('\n❌ Error in latest pipeline:', e.message);
    process.exit(1);
  }
})();
