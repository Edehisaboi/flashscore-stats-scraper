# Flashscore Match Stats Scraper

This Actor enumerates football matches for selected Flashscore competitions and seasons, fetches each match's team-statistics feed, and outputs a stable wide Dataset row per match.

The Actor uses a hybrid approach:

1. A Playwright crawler opens the results page and clicks "Show more matches" until all rounds are visible.
2. Plain HTTP requests fetch the compact stats feed for each match ID using the confirmed `x-fsign` header.
3. Parsed stats are merged with DOM metadata into deterministic CSV-friendly objects.

Full time means regulation 90 minutes. Extra time and penalty shootout data are not included in FT columns.
