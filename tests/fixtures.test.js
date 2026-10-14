import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFixturesUrl,
  getCompetition,
  getCurrentSeasonYear,
} from '../src/competitions.js';
import { selectUpcoming } from '../src/enumerate.js';
import { buildFixtureRow, FIXTURE_FIELDS } from '../src/buildRow.js';
import { resolveFixtureRun, resolveMode } from '../src/input.js';

const SECOND = 1000;
const toEpochSeconds = (ms) => String(Math.floor(ms / SECOND));

test('Tier 1 competitions are registered with canonical slugs', () => {
  assert.equal(getCompetition('championship').slug, 'championship');
  assert.equal(getCompetition('liga_portugal').slug, 'liga-portugal');
  assert.equal(getCompetition('jupiler_pro_league').slug, 'jupiler-pro-league');
  assert.equal(getCompetition('laliga2').slug, 'laliga2');
  assert.equal(getCompetition('bundesliga_2').country, 'germany');
});

test('buildFixturesUrl targets the current-season fixtures page', () => {
  const competition = getCompetition('championship');
  assert.equal(
    buildFixturesUrl(competition),
    'https://www.flashscore.com/football/england/championship/fixtures/',
  );
});

test('getCurrentSeasonYear rolls season competitions over in the summer', () => {
  const season = getCompetition('premier_league');
  const calendar = getCompetition('community_shield');

  // July (month index 6) onward belongs to the new season's start year.
  assert.equal(getCurrentSeasonYear(season, new Date('2026-08-01T00:00:00Z')), 2026);
  assert.equal(getCurrentSeasonYear(season, new Date('2026-05-01T00:00:00Z')), 2025);
  // Calendar competitions always use the running year.
  assert.equal(getCurrentSeasonYear(calendar, new Date('2026-05-01T00:00:00Z')), 2026);
});

test('selectUpcoming keeps scheduled matches inside the window, ordered by kickoff', () => {
  const competition = getCompetition('championship');
  const nowMs = Date.UTC(2026, 7, 1, 0, 0, 0); // 2026-08-01
  const rec = (mid, statusCode, whenMs) => ({
    mid,
    homeTeam: `${mid} home`,
    awayTeam: `${mid} away`,
    homeTeamId: `${mid}-h`,
    awayTeamId: `${mid}-a`,
    homeSlug: 'home',
    awaySlug: 'away',
    homeScore: '',
    awayScore: '',
    round: 'Round 1',
    timestamp: whenMs == null ? '' : toEpochSeconds(whenMs),
    statusCode,
  });

  const records = [
    rec('later', '1', Date.UTC(2026, 7, 3)), // scheduled, in window
    rec('sooner', '1', Date.UTC(2026, 7, 2)), // scheduled, in window (earlier)
    rec('sooner', '1', Date.UTC(2026, 7, 2)), // the page repeats each record
    rec('finished', '3', Date.UTC(2026, 7, 3)), // finished -> excluded
    rec('lastday', '1', Date.UTC(2026, 7, 8, 21)), // scheduled late on the end date
    rec('faraway', '1', Date.UTC(2026, 7, 20)), // scheduled but after the end date
    rec('notime', '1', null), // scheduled but no kickoff -> excluded
  ];

  const matches = selectUpcoming(records, {
    competition,
    seasonYear: 2026,
    nowMs,
    endMs: Date.parse('2026-08-08T23:59:59.999Z'),
  });

  assert.equal(matches.length, 3);
  assert.deepEqual(matches.map((match) => match.mid), ['sooner', 'later', 'lastday']);
  assert.equal(matches[0].status, 'Scheduled');
  assert.equal(matches[0].dateUtc, new Date(Date.UTC(2026, 7, 2)).toISOString());
});

test('buildFixtureRow emits a metadata-only row without score columns', () => {
  const row = buildFixtureRow({
    competition: getCompetition('championship'),
    season: '2026-2027',
    match: {
      mid: 'abc123',
      matchUrl: 'https://www.flashscore.com/match/abc123/',
      status: 'Scheduled',
      dateUtc: '2026-08-21T19:00:00.000Z',
      kickoff: '2026-08-21T19:00:00.000Z',
      round: 'Round 1',
      homeTeam: 'Wolves',
      homeTeamId: 'h1',
      awayTeam: 'Blackburn',
      awayTeamId: 'a1',
    },
  });

  assert.equal(row.competition, 'Championship');
  assert.equal(row.country, 'england');
  assert.equal(row.season, '2026-2027');
  assert.equal(row.competition_key, 'championship');
  assert.equal(row.match_id, 'abc123');
  assert.equal(row.status, 'Scheduled');
  assert.equal(row.date_utc, '2026-08-21T19:00:00.000Z');
  assert.equal(row.home_team, 'Wolves');
  assert.equal(row.away_team_id, 'a1');
  assert.deepEqual(Object.keys(row), [...FIXTURE_FIELDS]);
  assert.ok(!('home_score_ft' in row));
});

test('resolveMode defaults to season_stats and rejects unknown modes', () => {
  assert.equal(resolveMode({}), 'season_stats');
  assert.equal(resolveMode({ mode: 'fixtures' }), 'fixtures');
  assert.equal(resolveMode({ mode: 'fetch_stats' }), 'fetch_stats');
  assert.equal(resolveMode({ mode: 'season_stats' }), 'season_stats');

  // The old name is gone rather than aliased, so a stale caller fails loudly
  // instead of silently running a season-wide backfill.
  assert.throws(() => resolveMode({ mode: 'results' }), /Unknown mode/);
  assert.throws(() => resolveMode({ mode: 'anything-else' }), /Unknown mode/);
});

test('resolveFixtureRun expands "all", dedupes lists, and validates input', () => {
  const now = new Date('2026-08-01T10:00:00Z');
  const all = resolveFixtureRun({ competitions: 'all' }, now);
  assert.ok(all.competitions.includes('premier_league'));
  assert.ok(all.competitions.includes('laliga2'));
  assert.equal(all.endDate, '2026-08-08');
  assert.equal(all.endMs, Date.parse('2026-08-08T23:59:59.999Z'));

  const picked = resolveFixtureRun(
    { competitions: ['la_liga', 'serie_b', 'la_liga'], endDate: '2026-08-20' },
    now,
  );
  assert.deepEqual(picked.competitions, ['la_liga', 'serie_b']);
  assert.equal(picked.endDate, '2026-08-20');
  assert.equal(resolveFixtureRun({ endDate: '2026-08-01' }, now).endDate, '2026-08-01');

  assert.deepEqual(resolveFixtureRun({}, now).competitions, ['premier_league']);

  assert.equal(resolveFixtureRun({ endDate: '2026-09-30' }, now).endDate, '2026-08-31');
  assert.equal(resolveFixtureRun({ endDate: '2026-08-31' }, now).endDate, '2026-08-31');
  assert.equal(resolveFixtureRun({ endDate: '2026-08-32' }, now).endDate, '2026-08-01');
  assert.equal(resolveFixtureRun({ endDate: 'next week' }, now).endDate, '2026-08-01');

  assert.throws(() => resolveFixtureRun({ competitions: ['not_a_league'] }, now), /Unknown competition/);
  assert.throws(() => resolveFixtureRun({ endDate: '2026-07-31' }, now), /not be before today/);
});
