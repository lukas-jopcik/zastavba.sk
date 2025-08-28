// run_all.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd) {
  console.log(`\n▶️ Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: '/bin/sh' });
}

function findLatest(patternSuffix) {
  // patternSuffix: "_eia.json" alebo "_sea.json"
  const dir = 'data_raw';
  if (!fs.existsSync(dir)) throw new Error(`Missing folder: ${dir}`);

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(patternSuffix))
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);

  if (!files.length) {
    throw new Error(`No files matching *${patternSuffix} in ${dir}`);
  }
  return path.join(dir, files[0].f);
}

function ensureExists(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
}

(async () => {
  try {
    // 1) Collect – ak zlyhá, execSync vyhodí chybu
    run('node collect_enviroportal_list.js');

    // 2) Zober NAJNOVŠIE raw súbory (nezávislé od dátumu/pásma)
    const inEia = findLatest('_eia.json');
    const inSea = findLatest('_sea.json');
    console.log(`Using raw: ${inEia} / ${inSea}`);

    // 3) Enrich
    run(`node enrich_eia_details.js ${inEia}`);
    run(`node enrich_eia_details.js ${inSea}`);

    // 4) Najnovšie ENRICHED (suffix _enriched.json)
    function findLatestEnriched(suffix) {
      const dir = 'data_enriched';
      if (!fs.existsSync(dir)) throw new Error(`Missing folder: ${dir}`);
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith(suffix))
        .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      if (!files.length) throw new Error(`No files matching *${suffix} in ${dir}`);
      return path.join(dir, files[0].f);
    }

    const outEia = findLatestEnriched('_eia_enriched.json');
    const outSea = findLatestEnriched('_sea_enriched.json');
    console.log(`Using enriched: ${outEia} / ${outSea}`);

    // 5) Ingest
    run(`node ingest_json.js ${outEia}`);
    run(`node ingest_json.js ${outSea}`);

    console.log('\n✅ All done');
  } catch (err) {
    console.error('❌ Error in pipeline:', err.message);
    process.exit(1);
  }
})();
