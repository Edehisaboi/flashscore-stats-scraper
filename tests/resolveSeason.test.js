import assert from 'node:assert/strict';
import test from 'node:test';
import { COMPETITION_BY_KEY } from '../src/competitions.js';
import { findSeasonLink } from '../src/resolveSeason.js';

test('findSeasonLink resolves a season archive entry by start year', () => {
  const competition = COMPETITION_BY_KEY.premier_league;
  const html = `
    <a href="/football/england/premier-league-2023-2024/">Premier League 2023/2024</a>
    <a href="/football/england/premier-league-2024-2025/">Premier League 2024/2025</a>
  `;

  const match = findSeasonLink(html, 'https://www.flashscore.com/football/england/premier-league/archive/', competition, 2024);

  assert.equal(match.label, 'Premier League 2024/2025');
  assert.equal(match.seasonUrl, 'https://www.flashscore.com/football/england/premier-league-2024-2025/');
});

test('findSeasonLink resolves a calendar-year competition entry', () => {
  const competition = COMPETITION_BY_KEY.uefa_super_cup;
  const html = `
    <a href="/football/europe/uefa-super-cup-2023/">UEFA Super Cup 2023</a>
    <a href="/football/europe/uefa-super-cup-2024/">UEFA Super Cup 2024</a>
  `;

  const match = findSeasonLink(html, 'https://www.flashscore.com/football/europe/uefa-super-cup/archive/', competition, 2024);

  assert.equal(match.label, 'UEFA Super Cup 2024');
});
