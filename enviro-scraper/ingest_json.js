const fs = require('fs');
const { upsertItem } = require('./db');
require('dotenv').config();

async function ingest(jsonPath) {
  const arr = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const row of arr) {
    await upsertItem(row);
    console.log('⬆️  Saved:', row.title);
  }
}

if (require.main === module) {
  const f = process.argv[2];
  if (!f) {
    console.error('❌ Missing JSON file');
    process.exit(1);
  }
  ingest(f).then(() => {
    console.log('✅ Done ingest');
    process.exit(0);
  });
}
