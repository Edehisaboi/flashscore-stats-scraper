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
    rec('finished', '3', Date.UTC(2026, 7, 3)), // finished -> excluded
    rec('faraway', '1', Date.UTC(2026, 7, 20)), // scheduled but outside 7d window
    rec('notime', '1', null), // scheduled but no kickoff -> excluded
  ];

  const matches = selectUpcoming(records, {
    competition,
    seasonYear: 2026,
    nowMs,
    windowDays: 7,
  });

  assert.equal(matches.length, 2);
  assert.deepEqual(matches.map((match) => match.mid), ['sooner', 'later']);
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
  assert.equal(row.match_id, 'abc123');
  assert.equal(row.status, 'Scheduled');
  assert.equal(row.date_utc, '2026-08-21T19:00:00.000Z');
  assert.equal(row.home_team, 'Wolves');
  assert.equal(row.away_team_id, 'a1');
  assert.deepEqual(Object.keys(row), [...FIXTURE_FIELDS]);
  assert.ok(!('home_score_ft' in row));
});

test('resolveMode defaults to results and reads fixtures explicitly', () => {
  assert.equal(resolveMode({}), 'results');
  assert.equal(resolveMode({ mode: 'fixtures' }), 'fixtures');
  assert.equal(resolveMode({ mode: 'anything-else' }), 'results');
});

test('resolveFixtureRun expands "all", dedupes lists, and validates input', () => {
  const all = resolveFixtureRun({ competitions: 'all' });
  assert.ok(all.competitions.includes('premier_league'));
  assert.ok(all.competitions.includes('laliga2'));
  assert.equal(all.windowDays, 7);

  const picked = resolveFixtureRun({ competitions: ['la_liga', 'serie_b', 'la_liga'], windowDays: 3 });
  assert.deepEqual(picked.competitions, ['la_liga', 'serie_b']);
  assert.equal(picked.windowDays, 3);

  assert.deepEqual(resolveFixtureRun({}).competitions, ['premier_league']);

  assert.throws(() => resolveFixtureRun({ competitions: ['not_a_league'] }), /Unknown competition/);
  assert.throws(() => resolveFixtureRun({ windowDays: 0 }), /windowDays must be between/);
  assert.throws(() => resolveFixtureRun({ windowDays: 45 }), /windowDays must be between/);
});
