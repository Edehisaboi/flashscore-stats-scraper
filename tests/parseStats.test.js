import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRecord, parseStatsFeed } from '../src/parseStats.js';

const KV = '\u00f7';
const FIELD = '\u00ac';

test('parseRecord decodes Flashscore key-value fields', () => {
  const record = parseRecord(`SD${KV}432${FIELD}SG${KV}Expected goals (xG)${FIELD}SH${KV}1.79${FIELD}SI${KV}0.27`);

  assert.deepEqual(record, {
    SD: '432',
    SG: 'Expected goals (xG)',
    SH: '1.79',
    SI: '0.27',
  });
});

test('parseStatsFeed groups stat rows by period and carries stat group', () => {
  const feed = [
    `SE${KV}Match`,
    `SF${KV}Top stats`,
    `SD${KV}432${FIELD}SG${KV}Expected goals (xG)${FIELD}SH${KV}1.79${FIELD}SI${KV}0.27`,
    `SD${KV}12${FIELD}SG${KV}Ball possession${FIELD}SH${KV}63%${FIELD}SI${KV}37%`,
    `SD${KV}342${FIELD}SG${KV}Passes${FIELD}SH${KV}82% (405/496)${FIELD}SI${KV}74% (301/409)`,
    `SE${KV}1st Half`,
    `SF${KV}Top stats`,
    `SD${KV}432${FIELD}SG${KV}Expected goals (xG)${FIELD}SH${KV}0.88${FIELD}SI${KV}0.25`,
  ].join('~');

  const periods = parseStatsFeed(feed);

  assert.equal(periods.Match.length, 3);
  assert.equal(periods['1st Half'].length, 1);
  assert.deepEqual(periods.Match[0], {
    id: '432',
    label: 'Expected goals (xG)',
    home: '1.79',
    away: '0.27',
    group: 'Top stats',
  });
});
