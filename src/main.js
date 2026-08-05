import { Actor, log } from 'apify';
import pLimit from 'p-limit';
import { buildFixtureRow, buildRow, createRowPlan, FIXTURE_FIELDS } from './buildRow.js';
import { buildFixturesUrl, getCompetition, getCurrentSeasonYear, getSeasonLabel } from './competitions.js';
import { enumerateFixtures, enumerateMatches } from './enumerate.js';
import { fetchStats, fetchSummary } from './feeds.js';
import {
  DEFAULT_PROXY_CONFIGURATION,
  normalizeProxyConfiguration,
  resolveFixtureRun,
  resolveJobs,
  resolveMode,
} from './input.js';
import { parseStatsFeed } from './parseStats.js';
import { parseSummaryFeed } from './parseSummary.js';
import { resolveSeason } from './resolveSeason.js';
import { logInfo, logWarning } from './util.js';

await Actor.main(async () => {
  const input = await Actor.getInput() || {};
  const maxConcurrency = Number.isInteger(input.maxConcurrency) ? input.maxConcurrency : 10;
  const proxyInput = normalizeProxyConfiguration(input.proxyConfiguration || DEFAULT_PROXY_CONFIGURATION);
  const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);

  // Fixtures mode scrapes upcoming matches (metadata only, no stats feeds), so it
  // never needs the residential proxy escalation the stats feeds rely on.
  if (resolveMode(input) === 'fixtures') {
    await runFixtures({ input, proxyConfiguration, maxConcurrency });
    return;
  }

  const residentialProxyConfiguration = proxyInput.useApifyProxy === false
    ? undefined
    : await Actor.createProxyConfiguration({
      useApifyProxy: true,
      groups: ['RESIDENTIAL'],
      checkAccess: false,
    });

  await runResults({ input, proxyConfiguration, residentialProxyConfiguration, maxConcurrency });
});

async function runResults({ input, proxyConfiguration, residentialProxyConfiguration, maxConcurrency }) {
  const jobs = resolveJobs(input);
  const includePeriods = input.includePeriods || ['ft', '1h'];
  // Cup competitions include early qualifying rounds with no statistics; by
  // default we drop stat-less matches so the output only contains useful rows.
  const onlyWithStats = input.onlyWithStats !== false;
  const records = [];
  const summaries = [];

  for (const job of jobs) {
    const competition = getCompetition(job.competition);
    const startedAt = new Date().toISOString();

    await Actor.setStatusMessage(`Resolving ${competition.title} ${job.year}`);
    const seasonResolution = await resolveSeason({
      competition,
      year: job.year,
      proxyConfiguration,
      log,
    });

    await Actor.setStatusMessage(`Enumerating ${competition.title} ${seasonResolution.season}`);
    const { matches, liveFsign } = await enumerateMatches({
      resultsUrl: seasonResolution.resultsUrl,
      competition,
      year: job.year,
      proxyConfiguration,
      log,
    });

    const limit = pLimit(maxConcurrency);
    let withStats = 0;
    let failed = 0;
    const failures = [];

    await Actor.setStatusMessage(`Fetching stats for ${matches.length} ${competition.title} matches`);
    const jobRecords = await Promise.all(matches.map((match) => limit(async () => {
      const feedOptions = {
        proxyConfiguration,
        residentialProxyConfiguration,
        fallbackFsign: liveFsign,
        log,
      };

      try {
        const response = await fetchStats(match.mid, feedOptions);
        const statsByPeriod = response.noStats ? {} : parseStatsFeed(response.body);
        const hasStats = Object.keys(statsByPeriod).length > 0;

        if (hasStats) {
          withStats += 1;
          // Summary feed (HT + regulation FT) is only worth fetching for matches
          // that actually have statistics; failure is non-fatal.
          const summaryResponse = await fetchSummary(match.mid, feedOptions).catch(() => null);
          mergeSummary(match, summaryResponse);
        }

        return {
          competition,
          year: job.year,
          season: seasonResolution.season,
          match,
          statsByPeriod,
          hasStats,
          feed: { host: response.host, proxyTier: response.proxyTier, noStats: response.noStats },
        };
      } catch (error) {
        failed += 1;
        failures.push({ mid: match.mid, matchUrl: match.matchUrl, message: error.message });
        logWarning(log, `Stats fetch failed for ${match.mid}`, { message: error.message });

        return {
          competition,
          year: job.year,
          season: seasonResolution.season,
          match,
          statsByPeriod: {},
          hasStats: false,
          feed: { noStats: true, error: error.message },
        };
      }
    })));

    records.push(...jobRecords);
    summaries.push({
      competition: competition.key,
      title: competition.title,
      year: job.year,
      season: seasonResolution.season,
      resultsUrl: seasonResolution.resultsUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      matchesFound: matches.length,
      matchesWithStats: withStats,
      matchesWithoutStats: matches.length - withStats - failed,
      statsFailed: failed,
      onlyWithStats,
      failures,
    });
  }

  const outputRecords = onlyWithStats ? records.filter((record) => record.hasStats) : records;
  const rowPlan = createRowPlan(outputRecords, includePeriods);
  const rows = outputRecords.map((record) => buildRow(record, rowPlan));

  if (rows.length) {
    await Actor.pushData(rows);
  }

  const output = {
    mode: 'results',
    generatedAt: new Date().toISOString(),
    jobs: summaries,
    totalRows: rows.length,
    columns: rowPlan.outputFields,
  };

  await Actor.setValue('OUTPUT', output);
  await Actor.setStatusMessage(`Finished: ${rows.length} rows`);
  logInfo(log, 'Run summary', output);
}

async function runFixtures({ input, proxyConfiguration, maxConcurrency }) {
  const { competitions, windowDays } = resolveFixtureRun(input);
  const now = new Date();
  const limit = pLimit(maxConcurrency);

  await Actor.setStatusMessage(
    `Fetching upcoming fixtures for ${competitions.length} competition(s) over ${windowDays}d`,
  );

  const results = await Promise.all(competitions.map((key) => limit(async () => {
    const competition = getCompetition(key);
    const fixturesUrl = buildFixturesUrl(competition);
    const seasonYear = getCurrentSeasonYear(competition, now);
    const season = getSeasonLabel(competition, seasonYear);
    const startedAt = new Date().toISOString();

    try {
      const { matches } = await enumerateFixtures({
        fixturesUrl,
        competition,
        seasonYear,
        windowDays,
        now,
        proxyConfiguration,
        log,
      });

      const rows = matches.map((match) => buildFixtureRow({ competition, season, match }));

      return {
        rows,
        summary: {
          competition: competition.key,
          title: competition.title,
          season,
          fixturesUrl,
          startedAt,
          finishedAt: new Date().toISOString(),
          fixturesFound: rows.length,
          error: null,
        },
      };
    } catch (error) {
      logWarning(log, `Fixtures fetch failed for ${competition.title}`, { message: error.message });

      return {
        rows: [],
        summary: {
          competition: competition.key,
          title: competition.title,
          season,
          fixturesUrl,
          startedAt,
          finishedAt: new Date().toISOString(),
          fixturesFound: 0,
          error: error.message,
        },
      };
    }
  })));

  const rows = results.flatMap((result) => result.rows);
  const summaries = results.map((result) => result.summary);

  if (rows.length) {
    await Actor.pushData(rows);
  }

  const output = {
    mode: 'fixtures',
    generatedAt: new Date().toISOString(),
    windowDays,
    jobs: summaries,
    totalRows: rows.length,
    columns: FIXTURE_FIELDS,
  };

  await Actor.setValue('OUTPUT', output);
  await Actor.setStatusMessage(`Finished: ${rows.length} upcoming fixtures`);
  logInfo(log, 'Fixtures run summary', output);
}

// Merge halftime score and regulation full-time score from the match summary
// feed. Summary FT (1st half + 2nd half) is authoritative regulation and
// overrides the listing score, which can show the after-extra-time result.
function mergeSummary(match, summaryResponse) {
  if (!summaryResponse || summaryResponse.noStats) {
    return;
  }

  const summary = parseSummaryFeed(summaryResponse.body);

  if (summary.homeScoreHt !== '') match.homeScoreHt = summary.homeScoreHt;
  if (summary.awayScoreHt !== '') match.awayScoreHt = summary.awayScoreHt;
  if (summary.homeScoreFt !== '') match.homeScoreFt = summary.homeScoreFt;
  if (summary.awayScoreFt !== '') match.awayScoreFt = summary.awayScoreFt;
}
