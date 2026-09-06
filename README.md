# Draftroom

A responsive React dashboard for manually tracking a live fantasy football snake draft.

## Run with Docker Compose

```sh
cd /home/johnny/docker/fantasy_football
docker compose up -d --build
```

Open **http://localhost:5173**, or **http://<server-ip>:5173** from another device.
Compose builds the app and starts PostgreSQL automatically. Optional settings are
in `.env.example`: copy it to `.env` before the first start to change `APP_PORT`
or `POSTGRES_PASSWORD`. PostgreSQL is only exposed inside the Compose network.
This is one shared workspace for a trusted home/LAN network, with no login.

```sh
docker compose logs -f app       # app logs
docker compose down              # stop; retain database
docker compose up -d --build     # start or rebuild after code/ranking changes
```

All draft data (picks, settings, player pool, ranking metadata, watchlist, view/search
preferences, and the pre-ranking-migration backup) is stored as JSONB in PostgreSQL.
The named `postgres_data` volume survives restarts, rebuilds, and `docker compose down`.
**`docker compose down -v` deletes the database volume.** Temporary dialogs and
notifications are not saved. Wait for “Saved to PostgreSQL” before closing the page.
Save failures remain visible with retry/export options. Concurrent stale writes are
rejected: reload to see another browser's changes. Live cross-browser updates are
not pushed automatically.

On first use of an empty database, the app imports existing browser storage from
that same browser and origin (scheme, hostname, and port). If the old app used a
different address, export the draft there first, then use **Settings & data → Restore
draft export** in this app. Existing database data takes precedence over browser
storage. Browser storage is retained as a migration backup but is no longer written.

Back up and restore the database:

```sh
docker compose exec -T db pg_dump -U draftroom -d draftroom --clean --if-exists > draftroom.sql
# Restore replaces the saved workspace with the backup:
docker compose stop app
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U draftroom -d draftroom < draftroom.sql
docker compose start app
```

## Local development

```sh
npm install
docker compose up -d db
```

Run the API with `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE` set for
an accessible PostgreSQL database: `npm start` (port 3000). The Compose database
has no host port by default; publish one using a local Compose override if needed.
Then run `npm run dev`; Vite proxies `/api` to port 3000. `npm run build` creates the
production assets. `npm test` runs draft tests; the database integration test runs
when `TEST_DATABASE_URL` points at a **dedicated test database** (it clears that
database's workspace table).

Set your league size, draft position, rounds, and scoring in Draft settings before recording picks. Use **Mark picked** for the team on the clock, and **Draft** when your team is up. Undo the last pick from Recent picks. The draft board shows every team's selections. Progress is saved in PostgreSQL; Export draft downloads a JSON snapshot for your records.

The app includes a dated 2026 full-PPR consensus snapshot from FantasyPros, enriched with Sleeper age/status and manager add/drop activity. The legacy sample pool is used only for migration/tests. Custom imports start a new draft and accept a JSON array:

```json
[{"name":"Player Name","team":"CIN","position":"WR","rank":1}]
```

Supported positions: QB, RB, WR, TE, K, DST. Recommendations use imported rank, open starter positions, depth penalties, and late-round kicker/defense preference. Scoring is a league label: import rankings appropriate to that scoring format. Defaults are 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 K, 1 DST, and bench slots for remaining rounds. Player tracking is manual; no platform sync or live injury feed is included. Watchlist selections are saved in PostgreSQL.

## Value-first PPR strategy

Recommendations now use the round of **your next selection**, including across snake-round boundaries. The strategy panel explains the current phase. Early selections favor RB/WR; middle selections allow QB/TE value; later selections favor RB/WR depth over duplicate QB/TE picks. Kicker and defense are heavily discounted before the last two rounds. Final recommendations preserve enough picks to fill required starter slots. Positional maximums remain enforced. All available players remain manually selectable within roster limits.

The app uses its own heuristic weights, informed by [FantasyPros strategy guidance](https://www.fantasypros.com/2026/08/2026-fantasy-football-draft-strategy-guide-expert-advice/) and [late-round guidance](https://www.fantasypros.com/2026/08/2026-fantasy-football-late-round-draft-strategy/). This is not an expert's exact algorithm or a proven optimal strategy. Rank discounts are relative to the imported overall rank, not ADP. No injury, upside, reception-volume, matchup, or future availability model is included. Recommendations use the bundled dated consensus snapshot unless you import your own rankings. The app does not poll for live updates.


## Refreshing player data

Run `npm run rankings:update`, then `docker compose up -d --build` to refresh the running app. Refresh at most daily to respect Sleeper's player endpoint guidance. The script verifies 2026, draft rather than weekly rankings, PPR format, and minimum pool size before atomically replacing `src/current-rankings.json`. Source URLs and retrieval time are embedded in the snapshot. Normal browser use makes no provider requests.

On reload, bundled snapshot upgrades preserve picks by player identity and keep unmatched drafted players as unranked history. A one-time backup is stored in the workspace’s `beforeRankings` field in PostgreSQL. Custom imports remain untouched; Settings & data offers a button to apply the bundled snapshot while preserving picks.

Age is calculated from date of birth at snapshot time and shown for context, not added as a blanket youth bonus. Team is taken from the ranking provider; differing biographical-source teams are flagged. Expert ranks remain primary. Manager interest uses the top-100 adds and drops over 24 hours, adding at most ±2 heuristic points to the strategy score. It is a limited popularity proxy, not social-media sentiment or a representative fan survey. Absence from a truncated list is unknown. Unavailable status flags and free agents are omitted from the shortlist but remain manually trackable. No live injury clearance, sentiment NLP, or team-strength model is claimed.
# fantasy_football
