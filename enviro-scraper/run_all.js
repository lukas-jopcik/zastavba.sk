// run_all.js
const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n▶️ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

(async () => {
  try {
    run('node collect_enviroportal_list.js');
    run('node enrich_eia_details.js data_raw/$(date +%F)_eia.json');
    run('node enrich_eia_details.js data_raw/$(date +%F)_sea.json');
    run('node ingest_json.js data_enriched/*_eia_enriched.json');
    run('node ingest_json.js data_enriched/*_sea_enriched.json');
    console.log('\n✅ All done');
  } catch (err) {
    console.error('❌ Error in pipeline:', err.message);
    process.exit(1);
  }
})();
