// run_all.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  console.log(`\n▶️ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: '/bin/sh' });
}

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function ensureExists(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing file: ${p}`);
  }
}

(async () => {
  try {
    // 1) Collect
    run('node collect_enviroportal_list.js');

    const d = today();
    const inEia = `data_raw/${d}_eia.json`;
    const inSea = `data_raw/${d}_sea.json`;

    ensureExists(inEia);
    ensureExists(inSea);

    // 2) Enrich
    run(`node enrich_eia_details.js ${inEia}`);
    run(`node enrich_eia_details.js ${inSea}`);

    const outEia = `data_enriched/${d}_eia_enriched.json`;
    const outSea = `data_enriched/${d}_sea_enriched.json`;

    ensureExists(outEia);
    ensureExists(outSea);

    // 3) Ingest (bez globa)
    run(`node ingest_json.js ${outEia}`);
    run(`node ingest_json.js ${outSea}`);

    console.log('\n✅ All done');
  } catch (err) {
    console.error('❌ Error in pipeline:', err.message);
    process.exit(1);
  }
})();
