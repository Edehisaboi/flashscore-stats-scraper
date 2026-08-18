# Flashscore Match Stats Scraper

This Actor enumerates football matches for selected Flashscore competitions and seasons, fetches each match's team-statistics feed, and outputs a stable wide Dataset row per match.

Everything is plain HTTP — there is no browser:

1. Season and match listings are fetched as HTML and parsed with cheerio.
2. Plain HTTP requests fetch the compact stats feed for each match ID using the confirmed `x-fsign` header.
3. Parsed stats are merged with listing metadata into deterministic CSV-friendly objects.

### Modes

| Mode | Input it reads | What it does |
| --- | --- | --- |
| `season_stats` (default) | `jobs`, or `competition` + `year` | A whole season of finished matches with statistics. Use for backfill. |
| `fixtures` | `competitions`, `windowDays` | Upcoming matches, metadata only. |
| `fetch_stats` | `matchIds` | Statistics for specific matches by Flashscore match id. Skips season resolution and enumeration, so it is the cheap incremental option once you already hold the ids. |

`fetch_stats` has no competition listing to read a status from, so it reports `status: "finished"` only when the summary feed yields a regulation full-time score, and an empty status otherwise. An empty status means "no result available yet" — it does not distinguish a postponed match from one that has not kicked off.

Full time means regulation 90 minutes. Extra time and penalty shootout data are not included in FT columns.
