import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRow, createRowPlan } from '../src/buildRow.js';
import { resolveMatchIds, resolveMode } from '../src/input.js';
import { deriveMatchStatus, mergeSummary } from '../src/parseSummary.js';

// Summary feed shape: BA/BB are 1st-half home/away, BC/BD are 2nd-half.
const summaryBody = (records) => records.join('~');
const finishedSummary = summaryBody(['BA÷1', 'BB÷0', 'BC÷2', 'BD÷1']);

test('resolveMatchIds trims, dedupes, and requires at least one id', () => {
  assert.deepEqual(resolveMatchIds({ matchIds: ['abc123', ' def456 ', 'abc123'] }), ['abc123', 'def456']);

  assert.throws(() => resolveMatchIds({}), /non-empty matchIds/);
  assert.throws(() => resolveMatchIds({ matchIds: [] }), /non-empty matchIds/);
  assert.throws(() => resolveMatchIds({ matchIds: ['', '  '] }), /non-empty matchIds/);
});

test('fetch_stats is a recognised mode', () => {
  assert.equal(resolveMode({ mode: 'fetch_stats' }), 'fetch_stats');
});

test('a match with a regulation full-time score is reported finished', () => {
  const match = mergeSummary({ mid: 'abc123' }, { body: finishedSummary, noStats: false });

  assert.equal(match.homeScoreFt, 3);
  assert.equal(match.awayScoreFt, 1);
  assert.equal(match.homeScoreHt, 1);
  assert.equal(deriveMatchStatus(match), 'finished');
});

test('a match with no summary is left unknown rather than guessed at', () => {
  // Postponed, cancelled, or simply not played yet all look the same from the
  // feeds alone. Reporting "" keeps the caller retrying instead of promoting a
  // fixture that never kicked off.
  assert.equal(deriveMatchStatus(mergeSummary({ mid: 'abc123' }, null)), '');
  assert.equal(deriveMatchStatus(mergeSummary({ mid: 'abc123' }, { noStats: true })), '');
  assert.equal(deriveMatchStatus({}), '');
});

test('a 0-0 draw is finished, not mistaken for a missing result', () => {
  const match = mergeSummary({ mid: 'abc123' }, {
    body: summaryBody(['BA÷0', 'BB÷0', 'BC÷0', 'BD÷0']),
    noStats: false,
  });

  assert.equal(match.homeScoreFt, 0);
  assert.equal(deriveMatchStatus(match), 'finished');
});

test('a row built without a competition listing still carries id, status and scores', () => {
  // fetch_stats has no listing page, so the record has only a minimal match
  // object. Everything ParlayHux joins on must still survive.
  const match = mergeSummary({ mid: 'abc123' }, { body: finishedSummary, noStats: false });
  match.status = deriveMatchStatus(match);

  const record = { match, statsByPeriod: {}, hasStats: false };
  const row = buildRow(record, createRowPlan([record], ['ft']));

  assert.equal(row.match_id, 'abc123');
  assert.equal(row.status, 'finished');
  assert.equal(row.home_score_ft, 3);
  assert.equal(row.away_score_ft, 1);
  assert.equal(row.home_score_ht, 1);
  assert.match(row.match_url, /abc123/);
  // Listing-only metadata is absent, not fabricated.
  assert.equal(row.competition, '');
  assert.equal(row.home_team, '');
});
