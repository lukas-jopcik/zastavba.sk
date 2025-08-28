// collect_enviroportal_list.js
/*
  Usage:
    node collect_enviroportal_list.js
    MAX_PAGES=100 node collect_enviroportal_list.js
    WRITE_DB=1 node collect_enviroportal_list.js   // per-page batch persist do DB
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const { normalizeAndGeocode } = require('./normalize_and_geocode'); // ← pridane
const { upsertItem } = require('./db'); // ← pridane

const START_URL = 'https://www.enviroportal.sk/eia-sea/informacny-system';
const MAX_PAGES = Number(process.env.MAX_PAGES || 930);
const WRITE_DB = process.env.WRITE_DB === '1';

function saveJSON(name, arr) {
  const dir = path.join(process.cwd(), 'data_raw');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${dayjs().format('YYYY-MM-DD')}_${name}.json`);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');
  console.log(`💾 Saved ${arr.length} → ${file}`);
}

function parseDateSkToISO(txt) {
  if (!txt) return null;
  const months = {
    'januára': '01', 'februára': '02', 'marca': '03', 'apríla': '04',
    'mája': '05', 'júna': '06', 'júla': '07', 'augusta': '08',
    'septembra': '09', 'októbra': '10', 'novembra': '11', 'decembra': '12'
  };
  const m = String(txt).trim().toLowerCase().match(/(\d{1,2})\.\s*([a-záäčďéíĺľňóôŕšťúýž]+)\s+(\d{4})/i);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mon = months[m[2]] || '01';
  const y = m[3];
  return `${y}-${mon}-${d}`;
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
  });

  await page.goto(START_URL, { waitUntil: '
