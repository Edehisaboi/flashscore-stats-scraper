import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRow, createRowPlan, METADATA_FIELDS } from '../src/buildRow.js';
import { COMPETITION_BY_KEY } from '../src/competitions.js';

const competition = COMPETITION_BY_KEY.premier_league;

test('buildRow emits deterministic metadata and expanded pass columns', () => {
  const record = {
    competition,
    season: '2024-2025',
    match: {
      mid: '44RKa9ke',
      matchUrl: 'https://www.flashscore.com/match/football/44RKa9ke/#/match-summary',
      status: 'Finished',
      dateUtc: '2025-05-25T15:00:00.000Z',
      kickoff: '25.05. 15:00',
      round: 'Round 38',
      homeTeam: 'Bournemouth',
      homeTeamId: 'bournemouth-id',
      awayTeam: 'Leicester',
      awayTeamId: 'leicester-id',
      homeScoreFt: '2',
      awayScoreFt: '0',
      homeScoreHt: '1',
      awayScoreHt: '0',
    },
    statsByPeriod: {
      Match: [
        { id: '432', label: 'Expected goals (xG)', home: '1.79', away: '0.27', group: 'Top stats' },
        { id: '12', label: 'Ball possession', home: '63%', away: '37%', group: 'Top stats' },
        { id: '342', label: 'Passes', home: '82% (405/496)', away: '74% (301/409)', group: 'Passes' },
      ],
      '1st Half': [
        { id: '432', label: 'Expected goals (xG)', home: '0.88', away: '0.25', group: 'Top stats' },
        { id: '342', label: 'Passes', home: '81% (190/234)', away: '73% (121/166)', group: 'Passes' },
      ],
    },
  };
  const rowPlan = createRowPlan([record], ['ft', '1h']);
  const row = buildRow(record, rowPlan);

  assert.deepEqual(Object.keys(row).slice(0, METADATA_FIELDS.length), METADATA_FIELDS);
  assert.equal(row.competition, 'Premier League');
  assert.equal(row.home_expected_goals_ft, 1.79);
  assert.equal(row.away_ball_possession_ft, 37);
  assert.equal(row.home_passes_pct_ft, 82);
  assert.equal(row.home_passes_completed_ft, 405);
  assert.equal(row.away_passes_attempted_ft, 409);
  assert.equal(row.home_expected_goals_1h, 0.88);
  assert.equal(row.away_passes_completed_1h, 121);
});

test('buildRow derives regulation FT from halves when extra time is present', () => {
  const record = {
    competition,
    season: '2024-2025',
    match: {
      mid: 'cup12345',
      status: 'After Extra Time',
      homeTeam: 'Home',
      awayTeam: 'Away',
      homeScoreFt: '1',
      awayScoreFt: '1',
    },
    statsByPeriod: {
      Match: [
        { id: '432', label: 'Expected goals (xG)', home: '2.00', away: '1.00' },
      ],
      '1st Half': [
        { id: '432', label: 'Expected goals (xG)', home: '0.50', away: '0.10' },
      ],
      '2nd Half': [
        { id: '432', label: 'Expected goals (xG)', home: '0.70', away: '0.40' },
      ],
      'Extra Time': [
        { id: '432', label: 'Expected goals (xG)', home: '0.80', away: '0.50' },
      ],
    },
  };

  const rowPlan = createRowPlan([record], ['ft']);
  const row = buildRow(record, rowPlan);

  assert.equal(row.home_expected_goals_ft, 1.2);
  assert.equal(row.away_expected_goals_ft, 0.5);
});
