# France Brand Resolution System

The French government fuel price API (`data.economie.gouv.fr`) provides station locations and prices but **no brand information**. This system resolves brand names using three external POI databases, stored once and reused on every refresh.

## Architecture

```
French Gov API ──> Station data (prices + coords, no brand)
                        │
                        ▼
                  ┌─────────────┐
                  │  brands:FR  │  KV brand database (23k+ entries)
                  │  in KV      │  Built from Mapbox + Foursquare + Google
                  └─────────────┘
                        │
                        ▼
              Cron refresh (every 4h)
              matches brands by proximity (< 500m)
              applies overrides & blacklist
                        │
                        ▼
              stations:FR in KV (ready to serve)
```

## Brand Database Setup

The brand database needs to be built **once**. Run these endpoints in order after deploying:

```bash
# 1. Ensure station data exists
curl https://api.fuelsaver.one/cron

# 2. Primary: Mapbox category search (~5k cells, ~14k brands)
curl https://api.fuelsaver.one/api/fr/build-brands

# 3. Supplementary: Foursquare venue search (~9k new brands)
curl https://api.fuelsaver.one/api/fr/build-brands-fsq

# 4. Gap filler: Google Places for remaining unmatched stations (~500 new brands)
curl https://api.fuelsaver.one/api/fr/build-brands-google

# 5. Refresh to bake brands into station data
curl https://api.fuelsaver.one/cron
```

After this, the brand database is stored permanently in KV (`brands:FR` key, no expiration). Every 4-hour cron refresh automatically uses it.

**Re-run the build endpoints only when needed** (e.g., monthly, or when many new stations appear).

## API Keys Required

Configured in `wrangler.toml` (or as secrets):

| Variable | Service | Used by |
|---|---|---|
| `MAPBOX_TOKEN` | Mapbox Search Box v1 | `/api/fr/build-brands` |
| `FSQ_CLIENT_ID` | Foursquare v2 | `/api/fr/build-brands-fsq` |
| `FSQ_CLIENT_SECRET` | Foursquare v2 | `/api/fr/build-brands-fsq` |
| `GOOGLE_PLACES_KEY` | Google Places API (New) | `/api/fr/build-brands-google` |

## Manual Corrections

Edit `worker-unified/src/countries/france.js`:

### Remove a non-existent station

Add its ID to `STATION_BLACKLIST`:

```js
const STATION_BLACKLIST = new Set([
  '45250003', // TERRES DU MARCHAIS BARNAULT, Briare — doesn't exist
  'XXXXXXXX', // Add new ones here with a comment
]);
```

### Fix a wrong brand

Add its ID to `STATION_OVERRIDES`:

```js
const STATION_OVERRIDES = {
  '94700005': 'Esso', // 5 Avenue Léon Blum, Maisons-Alfort
};
```

### Finding a station ID

Query the API with coordinates near the station:

```bash
curl -s "https://api.fuelsaver.one/api/fr?lat=48.802&lng=2.436&radius=1" | python3 -m json.tool
```

The `id` field is the French government station identifier (usually matches the commune INSEE code + sequence number).

### After making changes

```bash
cd worker-unified
npx wrangler deploy
curl https://api.fuelsaver.one/cron
```

## Brand Normalization

The `BRAND_NORMALIZE` map in `france.js` ensures consistent brand names across all three data sources. Common mappings:

- `total`, `totalenergies`, `total access` → `TotalEnergies`
- `leclerc`, `e.leclerc` → `E.Leclerc`
- `intermarche`, `intermarché` → `Intermarché`
- `oil france` → `Oil!`

Non-brand names like `gonflage`, `parking`, `garage`, `lavage` are blacklisted via `BRAND_BLACKLIST` to prevent false matches.

## How Matching Works

1. **Brand DB** is loaded from KV and indexed into a spatial grid (0.01-degree cells, ~1.1km)
2. For each French gov station, the 9 surrounding grid cells are checked
3. The **closest** brand entry within **500m** is used
4. `STATION_OVERRIDES` take priority over automatic matches
5. `STATION_BLACKLIST` stations are excluded entirely

## Coverage

With all three sources combined: **~94% brand coverage** in urban areas, lower in very rural areas where POI databases have limited data.

| Source | Brands found | Endpoint |
|---|---|---|
| Mapbox | ~14,000 | `/api/fr/build-brands` |
| Foursquare | ~9,000 | `/api/fr/build-brands-fsq` |
| Google Places | ~500 | `/api/fr/build-brands-google` |
| **Total** | **~23,500** | — |
