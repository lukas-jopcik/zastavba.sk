# Enviro Scraper

## Lokálne spustenie
1. `npm install`
2. `npx playwright install --with-deps`
3. `cp .env.example .env` a vyplň `DATABASE_URL`
4. Spusti scraping a ingest:  
   ```bash
   npm run run:all
   ```

## Railway
1. Vytvor Railway Postgres plugin
2. Spusti `schema.sql` (môžeš cez `psql` alebo Railway console)
3. Pridaj projekt z tohto repo
4. Env vars: `DATABASE_URL`, `PGSSL=1`, `WRITE_DB=1`
5. Deploy, nastav Cron na `npm run run:all`

Výsledok: všetky EIA/SEA z Enviroportálu sú v tabuľke `enviro_items`.


## Latest-only pipeline (recommended for cron)
- Spustenie lokálne:
  ```bash
  npm run run:latest        # prejde prvých 10 strán (MAX_PAGES=10)
  MAX_PAGES=5 npm run run:latest
  ```

## Railway Cron
1. Importuj repo z GitHubu
2. Variables: `DATABASE_URL` (Railway reference), `PGSSL=1`, `WRITE_DB=1`, prípadne `MAX_PAGES=10`
3. Start Command: `node run_latest.js`
4. Cron (UTC): napr. každú hodinu `5 * * * *` alebo denne 04:10 UTC `10 4 * * *`
