// collect_enviroportal_list.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const START_URL = 'https://www.enviroportal.sk/eia-sea/informacny-system';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '1', 10); // môžeš dočasne znížiť napr. na 2 pri testovaní

// --- dirs ------------------------------------------------------
const RAW_DIR = path.join(process.cwd(), 'data_raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

// --- helpers ---------------------------------------------------
function saveJSON(name, arr) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const file = path.join(RAW_DIR, `${dayjs().format('YYYY-MM-DD')}_${name}.json`);
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
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    });

    // logging do diagnostiky na Railway
    page.on('console', (msg) => console.log('BROWSER:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER-ERROR:', err.message));
    page.on('response', (res) => {
      try {
        const u = res.url();
        if (u.includes('/eia-sea/informacny-system')) {
          console.log('HTTP', res.status(), u);
        }
      } catch {}
    });

    console.log('➡️  Go to listing:', START_URL);
    await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(700);

    // Cookie banner
    try {
      console.log('Trying cookie banner…');
      const cookieButtons = [
        'Súhlasím','Súhlas','Akceptujem','Prijať','Prijať všetko','Accept all','OK'
      ];
      for (const label of cookieButtons) {
        const btn = page.locator(`button:has-text("${label}")`).first();
        if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(300); break; }
      }
    } catch (e) {
      console.log('Cookie banner handling skipped:', e.message);
    }

    const fetchedAt = dayjs().toISOString();
    const eia = [];
    const sea = [];

    for (let p = 1; p <= MAX_PAGES; p++) {
      await page.waitForSelector('a.sCBwX[href*="/eia/detail/"], a.sCBwX[href*="/sea/detail/"]', { timeout: 30000 });

      const rows = await page.$$eval('.UMmpi', (cards) => {
        const out = [];
        for (const card of cards) {
          const a = card.querySelector('.Joo6F a.sCBwX');
          if (!a) continue;
          const href = new URL(a.getAttribute('href'), location.href).toString();
          const title = (a.textContent || '').trim().replace(/\s+/g, ' ');
          const regionEl = card.querySelector('p[class^="tooltip-region"]');
          const okresEl  = card.querySelector('p[class^="tooltip-okres"]');
          const obecEl   = card.querySelector('p[class^="tooltip-obec"]');
          const region = regionEl ? regionEl.textContent.trim() : null;
          const okres  = okresEl  ? okresEl.textContent.trim()  : null;
          const obec   = obecEl   ? obecEl.textContent.trim()   : null;
          const dateEl = card.querySelector('p[class^="tooltip-update"], p[class*="tooltip-update"]');
          const listed_date_text = dateEl ? (dateEl.textContent || '').trim() : null;
          out.push({ href, title, region, okres, obec, listed_date_text });
        }
        return out;
      });

      for (const r of rows) {
        const listed_date = parseDateSkToISO(r.listed_date_text);
        const base = {
          title: r.title || '(bez názvu)',
          date: listed_date || dayjs().format('YYYY-MM-DD'),
          listed_date: listed_date || null,
          region: r.region,
          municipality: r.obec,
          okres: r.okres,
          phase: null,
          cpv: [],
          buyer: null,
          value: null,
          detail_url: r.href,
          source_url: page.url(),
          has_pdf: false,
          raw_text_snippet: null,
          fetched_at: fetchedAt,
        };
        if (r.href.includes('/eia/detail/')) {
          eia.push({ source: 'eia', type: 'EIA', ...base });
        } else if (r.href.includes('/sea/detail/')) {
          sea.push({ source: 'sea', type: 'SEA', ...base });
        }
      }

      console.log(`✅ Page ${p}: ${rows.length} cards (total EIA=${eia.length}, SEA=${sea.length})`);

      const hasNext = await page.locator('.Z5AOv a[rel="next"]').first().isVisible().catch(() => false);
      if (p < MAX_PAGES && hasNext) {
        await page.click('.Z5AOv a[rel="next"]');
        await page.waitForTimeout(600);
      } else {
        console.log('⏹ No next page, stopping.');
        break;
      }
    }

    await browser.close();

    console.log(`\n📊 FINISHED: EIA=${eia.length}, SEA=${sea.length}, TOTAL=${eia.length + sea.length}`);
    saveJSON('eia', eia);
    saveJSON('sea', sea);
  } catch (err) {
    console.error('FATAL (collector):', err);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
})();
