import dayjs from 'dayjs';
import { pool } from './db.js';

// shell-runner bez child_process – importni priamo tvoje moduly
import './collect_enviroportal_list.js'; // ak bežia samostatne, vymeň za funkcie
import './enrich_eia_details.js';

async function main() {
  console.log('🚀 Enviroportal pipeline start', dayjs().format());
  // odporúčané: prerobiť skripty na exportované funkcie:
  // await runListing({ maxPages: Number(process.env.MAX_PAGES)||50 });
  // await runEnrich({ concurrency: 4 });
  console.log('✅ Done', dayjs().format());
  await pool.end();
}

main().catch(e => {
  console.error('❌ Pipeline failed:', e);
  process.exit(1);
});
