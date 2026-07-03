# Flashscore Match Stats Scraper

Apify Actor that scrapes football match metadata and team statistics from Flashscore for one or more competition/year jobs. It emits one flat, wide Dataset row per match so exports are friendly for CSV, Excel, and pandas.

## What it collects

- Match metadata from the competition results page: competition, season, teams, team IDs, score, status, round, match URL, and kickoff text.
- Team statistics from Flashscore's stats feed for regulation full time and first half.
- Stable wide columns with home and away values side by side.

Extra time and penalty shootouts are excluded from full-time stats. If a match went to extra time, the Actor derives regulation FT from the first-half and second-half feed blocks where available.

## Input

Use `jobs` for multiple runs in one Dataset:

```json
{
  "jobs": [
    { "competition": "premier_league", "year": 2024 },
    { "competition": "fa_cup", "year": 2024 }
  ],
  "maxConcurrency": 10
}
```

For season competitions, `year` is the start year. For example, `2024` resolves to `2024/2025`. Calendar competitions use the edition year.

## Output

Rows are pushed to the default Dataset. CSV column order is controlled by the insertion order in `src/buildRow.js`: metadata first, FT stats second, and 1H stats third. This is intentional because Apify Dataset views affect the Console table order, while CSV export follows object key order.

## Local run

```bash
npm install
npm test
apify run
```

For a quick smoke test, run a small cup/supercup competition before a full league season.
