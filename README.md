# Draftroom

A responsive React dashboard for manually tracking a live fantasy football snake draft.

## Run

```sh
npm install
npm run dev
```

Open the local URL Vite prints. `npm run build` creates the production build; `npm test` checks the draft logic.

Set your league size, draft position, rounds, and scoring in Draft settings before recording picks. Use **Mark picked** for the team on the clock, and **Draft** when your team is up. Undo the last pick from Recent picks. The draft board shows every team's selections. Progress is saved in localStorage on the current browser; Export draft downloads a JSON snapshot for your records.

The app includes a dated 2026 full-PPR consensus snapshot from FantasyPros, enriched with Sleeper age/status and manager add/drop activity. The legacy sample pool is used only for migration/tests. Custom imports start a new draft and accept a JSON array:

```json
[{"name":"Player Name","team":"CIN","position":"WR","rank":1}]
```

Supported positions: QB, RB, WR, TE, K, DST. Recommendations use imported rank, open starter positions, depth penalties, and late-round kicker/defense preference. Scoring is a league label: import rankings appropriate to that scoring format. Defaults are 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 K, 1 DST, and bench slots for remaining rounds. Player tracking is manual; no platform sync or live injury feed is included. Watchlist selections last for the current session.

## Value-first PPR strategy

Recommendations now use the round of **your next selection**, including across snake-round boundaries. The strategy panel explains the current phase. Early selections favor RB/WR; middle selections allow QB/TE value; later selections favor RB/WR depth over duplicate QB/TE picks. Kicker and defense are heavily discounted before the last two rounds. Final recommendations preserve enough picks to fill required starter slots. Positional maximums remain enforced. All available players remain manually selectable within roster limits.

The app uses its own heuristic weights, informed by [FantasyPros strategy guidance](https://www.fantasypros.com/2026/08/2026-fantasy-football-draft-strategy-guide-expert-advice/) and [late-round guidance](https://www.fantasypros.com/2026/08/2026-fantasy-football-late-round-draft-strategy/). This is not an expert's exact algorithm or a proven optimal strategy. Rank discounts are relative to the imported overall rank, not ADP. No injury, upside, reception-volume, matchup, or future availability model is included. Recommendations use the bundled dated consensus snapshot unless you import your own rankings. The app does not poll for live updates.


## Refreshing player data

Run `npm run rankings:update`, then `npm run build` if serving the production build. Refresh at most daily to respect Sleeper's player endpoint guidance. The script verifies 2026, draft rather than weekly rankings, PPR format, and minimum pool size before atomically replacing `src/current-rankings.json`. Source URLs and retrieval time are embedded in the snapshot. Normal browser use makes no provider requests.

On reload, bundled snapshot upgrades preserve picks by player identity and keep unmatched drafted players as unranked history. A one-time localStorage backup is stored under `draftroom-before-rankings`. Custom imports remain untouched; Settings & data offers a button to apply the bundled snapshot while preserving picks.

Age is calculated from date of birth at snapshot time and shown for context, not added as a blanket youth bonus. Team is taken from the ranking provider; differing biographical-source teams are flagged. Expert ranks remain primary. Manager interest uses the top-100 adds and drops over 24 hours, adding at most ±2 heuristic points to the strategy score. It is a limited popularity proxy, not social-media sentiment or a representative fan survey. Absence from a truncated list is unknown. Unavailable status flags and free agents are omitted from the shortlist but remain manually trackable. No live injury clearance, sentiment NLP, or team-strength model is claimed.
# fantasy_football
