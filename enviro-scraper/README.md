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
