CREATE TABLE IF NOT EXISTS eia_items (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,               -- eia | sea
  type TEXT,                          -- EIA | SEA
  title TEXT,
  date DATE,                          -- dátum behu (sync)
  listed_date DATE,                   -- dátum z listingu
  region TEXT,
  municipality TEXT,
  okres TEXT,
  phase TEXT,
  cpv TEXT[],
  buyer TEXT,
  value NUMERIC,
  detail_url TEXT UNIQUE NOT NULL,
  source_url TEXT,
  has_pdf BOOLEAN,
  raw_text_snippet TEXT,
  fetched_at TIMESTAMPTZ,
  purpose TEXT,
  process_type TEXT,
  obstaravatel TEXT,
  obstaravatel_ico TEXT,
  dotknuta_obec TEXT,
  prislusny_organ TEXT,
  legal_basis TEXT,
  snippet TEXT,
  municipality_norm TEXT,
  okres_norm TEXT,
  region_norm TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  geocode_confidence TEXT,
  first_seen TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eia_items_listed_date_idx ON eia_items(listed_date);
CREATE INDEX IF NOT EXISTS eia_items_region_idx ON eia_items(region);
CREATE INDEX IF NOT EXISTS eia_items_municipality_idx ON eia_items(municipality);
