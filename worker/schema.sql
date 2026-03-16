DROP TABLE IF EXISTS stations;

CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  brand TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  gasolina REAL,
  gasolina_ad REAL,
  etanol REAL,
  diesel REAL,
  gnv REAL,
  updated_at TEXT
);

CREATE INDEX idx_stations_lat ON stations (lat);
CREATE INDEX idx_stations_lng ON stations (lng);
