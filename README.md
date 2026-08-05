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

### Upcoming fixtures mode

Set `mode: "fixtures"` to scrape upcoming matches (metadata only — no statistics, since the matches are unplayed) for a set of competitions over a rolling window:

```json
{
  "mode": "fixtures",
  "competitions": ["premier_league", "la_liga", "championship"],
  "windowDays": 7
}
```

Use `"competitions": ["all"]` for every supported competition. Each row carries `competition, country, season, match_id, match_url, status, date_utc, kickoff, round, home_team, home_team_id, away_team, away_team_id`. The stable Flashscore team IDs make it easy to line fixtures up with odds and downstream models.

### Supported competitions

Big-five leagues + their domestic cups and super cups, the three UEFA club competitions, the two FIFA club events, plus (Tier 1 expansion) the big-five second divisions and other strong European top flights: Championship, Eredivisie, Liga Portugal, Super Lig, Jupiler Pro League, Scottish Premiership, 2. Bundesliga, Serie B, Ligue 2, LaLiga 2. See `src/competitions.js` for the full list of competition keys.

## Output

Rows are pushed to the default Dataset. CSV column order is controlled by the insertion order in `src/buildRow.js`: metadata first, FT stats second, and 1H stats third. This is intentional because Apify Dataset views affect the Console table order, while CSV export follows object key order.

## Local run

```bash
npm install
npm test
apify run
```

For a quick smoke test, run a small cup/supercup competition before a full league season.
