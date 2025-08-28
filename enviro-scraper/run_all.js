// run_all.js
const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n▶️ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

(async () => {
  try {
    // 1) collect
    run('node collect_enviroportal_list.js');

    // 2) enrich (aktuálny dátumové súbory)
    const date = new Date().toISOString().slice(0,10);
    const eiaRaw = `data_raw/${date}_eia.json`;
    const seaRaw = `data_raw/${date}_sea.json`;
    console.log(`\nUsing raw: ${eiaRaw} / ${seaRaw}`);

    run(`node enrich_eia_details.js ${eiaRaw}`);
    run(`node enrich_eia_details.js ${seaRaw}`);

    // 3) geocode (pracujeme nad _enriched.json)
    const eiaEnr = `data_enriched/${date}_eia_enriched.json`;
    const seaEnr = `data_enriched/${date}_sea_enriched.json`;
    run(`node geocode_locations.js ${eiaEnr}`);
    run(`node geocode_locations.js ${seaEnr}`);

    // 4) ingest (preferuj *_geo.json)
    const eiaGeo = `data_enriched/${date}_eia_enriched_geo.json`;
    const seaGeo = `data_enriched/${date}_sea_enriched_geo.json`;

    run(`node ingest_json.js ${eiaGeo}`);
    run(`node ingest_json.js ${seaGeo}`);

    console.log('\n✅ All done');
  } catch (e) {
    console.error('\n❌ Error in pipeline:', e.message);
    process.exit(1);
  }
})();
