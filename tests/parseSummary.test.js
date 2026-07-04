import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSummaryFeed } from '../src/parseSummary.js';

test('parseSummaryFeed derives HT and regulation FT from half scores', () => {
  // Bournemouth 2-0 Leicester: 1st half 0-0, 2nd half 2-0.
  const summary = parseSummaryFeed('AC÷3¬BA÷0¬BB÷0¬~BC÷2¬BD÷0¬~MIT÷REF¬MIV÷Smith L.¬~');

  assert.equal(summary.homeScoreHt, 0);
  assert.equal(summary.awayScoreHt, 0);
  assert.equal(summary.homeScoreFt, 2);
  assert.equal(summary.awayScoreFt, 0);
  assert.equal(summary.homeScorePens, '');
});

test('parseSummaryFeed captures penalty shootout and excludes it from FT', () => {
  // Community Shield: 1st half 0-0, 2nd half 1-1, pens 7-6.
  const summary = parseSummaryFeed('AC÷11¬BA÷0¬BB÷0¬~BC÷1¬BD÷1¬~RPA÷7¬RPB÷6¬~');

  assert.equal(summary.homeScoreHt, 0);
  assert.equal(summary.awayScoreHt, 0);
  assert.equal(summary.homeScoreFt, 1);
  assert.equal(summary.awayScoreFt, 1);
  assert.equal(summary.homeScorePens, 7);
  assert.equal(summary.awayScorePens, 6);
});

test('parseSummaryFeed returns blanks when scores are absent', () => {
  const summary = parseSummaryFeed('MIT÷REF¬MIV÷Someone¬~');

  assert.equal(summary.homeScoreHt, '');
  assert.equal(summary.homeScoreFt, '');
});
