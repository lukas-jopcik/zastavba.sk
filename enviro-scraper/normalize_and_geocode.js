const fs = require('fs');
const { upsertItem } = require('./db');
require('dotenv').config();

async function normalizeAndSave(jsonPath) {
  const arr = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const row of arr) {
    const norm = {
      ...row,
      region: row.region || null,
      municipality: row.municipality || null,
      okres: row.okres || null,
    };
    if (process.env.WRITE_DB) {
      await upsertItem(norm);
      console.log('⬆️  Saved:', norm.title);
    }
  }
}

if (require.main === module) {
  const f = process.argv[2];
  if (!f) {
    console.error('❌ Missing JSON file');
    process.exit(1);
  }
  normalizeAndSave(f).then(() => {
    console.log('✅ Done');
    process.exit(0);
  });
}
