import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFeedParams, parseMatchRecords } from '../src/enumerate.js';

test('extractFeedParams reads category, template, and season from results HTML', () => {
  const html = 'x TemplateId: "dYlOSQOD" y ["6_8_abc","1_198_dYlOSQOD"] z seasonId: 187,';
  const params = extractFeedParams(html);

  assert.deepEqual(params, { category: '198', templateId: 'dYlOSQOD', seasonId: '187' });
});

test('extractFeedParams returns null when identifiers are missing', () => {
  assert.equal(extractFeedParams('no ids here'), null);
});

test('parseMatchRecords decodes match rows from the results feed', () => {
  const blob = [
    'ZA÷ENGLAND¬ZEE÷header',
    'AA÷xQXUa3UG¬AD÷1779634800¬AC÷3¬ER÷Round 38¬AF÷Manchester Utd¬PY÷ppjDR086¬WV÷manchester-united¬AH÷3¬AE÷Brighton¬PX÷2XrRecc3¬WU÷brighton¬AG÷0',
  ].join('~');

  const records = parseMatchRecords(blob);

  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    mid: 'xQXUa3UG',
    homeTeam: 'Brighton',
    awayTeam: 'Manchester Utd',
    homeTeamId: '2XrRecc3',
    awayTeamId: 'ppjDR086',
    homeSlug: 'brighton',
    awaySlug: 'manchester-united',
    homeScore: '0',
    awayScore: '3',
    round: 'Round 38',
    timestamp: '1779634800',
    statusCode: '3',
  });
});
