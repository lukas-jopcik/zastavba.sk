// enrich_eia_details.js
/* Usage:
   node enrich_eia_details.js data_raw/2025-08-28_eia.json
   node enrich_eia_details.js data_raw/2025-08-28_sea.json
*/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2];
if (!INPUT) {
  console.error('❌ Missing input JSON.\n   Example: node enrich_eia_details.js data_raw/2025-08-28_eia.json');
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), 'data_enriched');
const CONCURRENCY = parseInt(process.env.ENRICH_CONCURRENCY || '5', 10);
const NAV_TIMEOUT = 45000;
const MAX_RETRIES = 3;

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function saveJSONLike(inputPath, arr, suffix = '') {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.basename(inputPath).replace(/\.json$/i, '');
  const out = path.join(OUT_DIR, `${base}${suffix}.json`);
  fs.writeFileSync(out, JSON.stringify(arr, null, 2), 'utf8');
  console.log(`💾 Saved ${arr.length} → ${out}`);
}
function normalizeText(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}
function extractIco(text) {
  const m = (text || '').match(/IČO:\s*([\d\s]+)/i);
  return m ? m[1].replace(/\s+/g, '') : null;
}
function pickLegal(pairs) {
  const RE = /(§|\bZ\.z\.|\d{1,3}\/\d{4})/i;
  for (const it of pairs) {
    if (RE.test(it.label) || RE.test(it.value)) {
      return `${it.label}: ${it.value}`.replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// --- robust label → value helpers (text-based) -----------------
const LABELS = {
  purpose: [
    'Účel projektu/plánu', 'Účel projektu', 'Účel plánu',
    'Úcel projektu/plánu', 'Ucel projektu/plánu'
  ],
  process_type: ['Druh procesu', 'Druh konania'],
  obstaravatel: ['Obstarávateľ', 'Obstaravateľ', 'Obstaravatel'],
  dotknuta_obec: ['Dotknutá obec', 'Dotknuta obec'],
  prislusny_organ: ['Príslušný orgán', 'Prislusný orgán', 'Prislusny organ'],
};

async function getValueByLabel(page, labelVariants) {
  return await page.evaluate((variants) => {
    function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
    const variantSet = variants.map(v => norm(v));

    const blocks = Array.from(document.querySelectorAll('div.hE2MV, div.eShFY'));
    for (const b of blocks) {
      const labelEl = b.querySelector('.YKVRf .ryE5f');
      const valueWrap = b.querySelector('div.-Ilyz');
      if (!labelEl || !valueWrap) continue;
      const label = norm(labelEl.textContent || '');
      if (variantSet.some(v => label.includes(norm(v)))) {
        const values = Array.from(valueWrap.querySelectorAll('p'))
          .map(p => (p.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (values.length) return values.join(' | ');
      }
    }

    const allTextEls = Array.from(document.querySelectorAll('p, span, div, h2, h3'));
    for (const el of allTextEls) {
      const txt = norm(el.textContent || '');
      if (!txt) continue;
      if (variantSet.some(v => txt.includes(norm(v)))) {
        let cur = el;
        for (let hop = 0; hop < 5 && cur; hop++, cur = cur.parentElement) {
          if (cur.classList && (cur.classList.contains('hE2MV') || cur.classList.contains('eShFY'))) {
            const valueWrap2 = cur.querySelector('div.-Ilyz');
            if (valueWrap2) {
              const values2 = Array.from(valueWrap2.querySelectorAll('p'))
                .map(p => (p.textContent || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
              if (values2.length) return values2.join(' | ');
            }
          }
        }
        let sib = el.parentElement;
        for (let hop = 0; hop < 3 && sib; hop++, sib = sib.nextElementSibling) {
          if (!sib) break;
          const w = sib.querySelector && sib.querySelector('div.-Ilyz');
          if (w) {
            const vv = Array.from(w.querySelectorAll('p'))
              .map(p => (p.textContent || '').replace(/\s+/g, ' ').trim())
              .filter(Boolean);
            if (vv.length) return vv.join(' | ');
          }
        }
      }
    }
    return null;
  }, labelVariants);
}

async function extractPairs(page) {
  const pairs = await page.$$eval('div.hE2MV, div.eShFY', (blocks) => {
    const out = [];
    for (const b of blocks) {
      const labelEl = b.querySelector('.YKVRf .ryE5f');
      const valueWrap = b.querySelector('div.-Ilyz');
      if (!labelEl || !valueWrap) continue;

      const label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim();
      const values = Array.from(valueWrap.querySelectorAll('p'))
        .map(p => (p.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const value = values.join(' | ');
      if (label && value) out.push({ label, value });
    }
    return out;
  }).catch(() => []);
  return pairs || [];
}

async function extractDetail(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

  // uistime sa, že titulok je na stránke
  await page.waitForSelector('h1.RVWQR', { timeout: NAV_TIMEOUT }).catch(() => {});

  const title = await page.$eval('h1.RVWQR', el => (el.textContent || '').trim()).catch(() => null);

  // počkaj chvíľu na hydration
  await page.waitForTimeout(300);

  // primárne: textové získanie hodnôt
  const purpose = await getValueByLabel(page, LABELS.purpose);
  const process_type = await getValueByLabel(page, LABELS.process_type);
  const obstaravatel = await getValueByLabel(page, LABELS.obstaravatel);
  const dotknuta_obec = await getValueByLabel(page, LABELS.dotknuta_obec);
  const prislusny_organ = await getValueByLabel(page, LABELS.prislusny_organ);

  // sekundárne: páry + legal
  const pairs = await extractPairs(page);
  const legal_basis = pickLegal(pairs);
  const obstaravatel_ico = extractIco(obstaravatel || '');
  const snippet = purpose || null;

  if (!purpose && !process_type && !obstaravatel && !dotknuta_obec && !prislusny_organ) {
    console.warn('  ⚠️  No detail fields found via text-matching on:', url);
  }

  return {
    title: title || null,
    purpose,
    process_type,
    obstaravatel,
    obstaravatel_ico,
    dotknuta_obec,
    prislusny_organ,
    legal_basis,
    snippet,
    detail_pairs: pairs,
  };
}

// --- main ------------------------------------------------------
(async () => {
  const inputArr = loadJSON(INPUT);
  console.log(`🔎 Input: ${INPUT} (records: ${inputArr.length})`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  });

  // cookie banner pre istotu
  try {
    const p = await ctx.newPage();
    await p.goto('https://www.enviroportal.sk', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await p.waitForTimeout(300);
    const agree = p.locator('button:has-text("Súhlas")').first();
    if (await agree.isVisible()) {
      await agree.click().catch(() => {});
    }
    await p.close();
  } catch {}

  let done = 0;
  const enriched = [];

  const batches = chunk(inputArr, CONCURRENCY);
  const total = inputArr.length;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    process.stdout.write(`\n📦 Batch ${batchIdx + 1}/${batches.length} (size ${batch.length})\n`);

    const results = await Promise.all(
      batch.map(async (row) => {
        const page = await ctx.newPage();
        let tries = 0;
        let data = null;
        while (tries < MAX_RETRIES) {
          tries++;
          try {
            const t0 = Date.now();
            data = await extractDetail(page, row.detail_url);
            const ms = Date.now() - t0;
            console.log(`  • ${done + 1}/${total} ok in ${ms}ms | ${row.detail_url}`);
            break;
          } catch (err) {
            console.warn(`  ! ${done + 1}/${total} try ${tries}/${MAX_RETRIES} failed: ${row.detail_url}\n    ${err.message}`);
            if (tries >= MAX_RETRIES) {
              data = { __enrich_error: err.message };
            } else {
              await page.waitForTimeout(500);
            }
          }
        }
        await page.close();

        const merged = {
          ...row,
          title: data?.title || row.title,
          purpose: data?.purpose ?? row.purpose ?? null,
          process_type: data?.process_type ?? row.process_type ?? null,
          obstaravatel: data?.obstaravatel ?? row.obstaravatel ?? null,
          obstaravatel_ico: data?.obstaravatel_ico ?? row.obstaravatel_ico ?? null,
          dotknuta_obec: data?.dotknuta_obec ?? row.dotknuta_obec ?? null,
          prislusny_organ: data?.prislusny_organ ?? row.prislusny_organ ?? null,
          legal_basis: data?.legal_basis ?? row.legal_basis ?? null,
          snippet: (row.raw_text_snippet || row.snippet) ? (row.raw_text_snippet || row.snippet) : (data?.snippet || null),
          detail_pairs: data?.detail_pairs ?? row.detail_pairs ?? [],
        };
        if (!merged.raw_text_snippet && data?.snippet) {
          merged.raw_text_snippet = data.snippet;
        }

        done++;
        if (done % 25 === 0 || done === total) {
          console.log(`  👉 Progress: ${done}/${total} enriched`);
        }
        return merged;
      })
    );

    enriched.push(...results);

    // priebežné uloženie po každom batchi
    saveJSONLike(INPUT, enriched, '_partial');
  }

  await ctx.close();
  await browser.close();

  saveJSONLike(INPUT, enriched, '_enriched');
  console.log('✅ Done.');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
