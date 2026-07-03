export const FLASH_SCORE_BASE_URL = 'https://www.flashscore.com';

export const COMPETITIONS = Object.freeze([
  {
    key: 'premier_league',
    title: 'Premier League',
    country: 'england',
    slug: 'premier-league',
    seasonType: 'season',
  },
  {
    key: 'fa_cup',
    title: 'FA Cup',
    country: 'england',
    slug: 'fa-cup',
    seasonType: 'season',
  },
  {
    key: 'efl_cup',
    title: 'EFL Cup',
    country: 'england',
    slug: 'efl-cup',
    seasonType: 'season',
  },
  {
    key: 'community_shield',
    title: 'Community Shield',
    country: 'england',
    slug: 'fa-community-shield',
    seasonType: 'calendar',
  },
  {
    key: 'ligue_1',
    title: 'Ligue 1',
    country: 'france',
    slug: 'ligue-1',
    seasonType: 'season',
  },
  {
    key: 'coupe_de_france',
    title: 'Coupe de France',
    country: 'france',
    slug: 'coupe-de-france',
    seasonType: 'season',
  },
  {
    key: 'trophee_des_champions',
    title: 'Trophee des Champions',
    country: 'france',
    slug: 'super-cup',
    seasonType: 'calendar',
  },
  {
    key: 'bundesliga',
    title: 'Bundesliga',
    country: 'germany',
    slug: 'bundesliga',
    seasonType: 'season',
  },
  {
    key: 'dfb_pokal',
    title: 'DFB-Pokal',
    country: 'germany',
    slug: 'dfb-pokal',
    seasonType: 'season',
  },
  {
    key: 'franz_beckenbauer_supercup',
    title: 'Franz Beckenbauer Supercup',
    country: 'germany',
    slug: 'super-cup',
    seasonType: 'calendar',
  },
  {
    key: 'serie_a',
    title: 'Serie A',
    country: 'italy',
    slug: 'serie-a',
    seasonType: 'season',
  },
  {
    key: 'coppa_italia',
    title: 'Coppa Italia',
    country: 'italy',
    slug: 'coppa-italia',
    seasonType: 'season',
  },
  {
    key: 'supercoppa_italiana',
    title: 'Supercoppa Italiana',
    country: 'italy',
    slug: 'super-cup',
    seasonType: 'calendar',
  },
  {
    key: 'la_liga',
    title: 'La Liga',
    country: 'spain',
    slug: 'laliga',
    seasonType: 'season',
  },
  {
    key: 'copa_del_rey',
    title: 'Copa del Rey',
    country: 'spain',
    slug: 'copa-del-rey',
    seasonType: 'season',
  },
  {
    key: 'supercopa_de_espana',
    title: 'Supercopa de Espana',
    country: 'spain',
    slug: 'super-cup',
    seasonType: 'calendar',
  },
  {
    key: 'champions_league',
    title: 'UEFA Champions League',
    country: 'europe',
    slug: 'champions-league',
    seasonType: 'season',
  },
  {
    key: 'europa_league',
    title: 'UEFA Europa League',
    country: 'europe',
    slug: 'europa-league',
    seasonType: 'season',
  },
  {
    key: 'conference_league',
    title: 'UEFA Conference League',
    country: 'europe',
    slug: 'conference-league',
    seasonType: 'season',
  },
  {
    key: 'uefa_super_cup',
    title: 'UEFA Super Cup',
    country: 'europe',
    slug: 'uefa-super-cup',
    seasonType: 'calendar',
  },
  {
    key: 'fifa_intercontinental_cup',
    title: 'FIFA Intercontinental Cup',
    country: 'world',
    slug: 'fifa-intercontinental-cup',
    seasonType: 'calendar',
  },
  {
    key: 'fifa_club_world_cup',
    title: 'FIFA Club World Cup',
    country: 'world',
    slug: 'fifa-club-world-cup',
    seasonType: 'calendar',
  },
]);

export const COMPETITION_BY_KEY = Object.freeze(
  Object.fromEntries(COMPETITIONS.map((competition) => [competition.key, competition])),
);

export function getCompetition(key) {
  const competition = COMPETITION_BY_KEY[key];

  if (!competition) {
    const validKeys = COMPETITIONS.map((item) => item.key).join(', ');
    throw new Error(`Unknown competition "${key}". Valid competition keys: ${validKeys}`);
  }

  return competition;
}

export function getSeasonLabel(competition, year) {
  return competition.seasonType === 'season' ? `${year}-${year + 1}` : String(year);
}

export function getSeasonDisplayLabel(competition, year) {
  return competition.seasonType === 'season' ? `${year}/${year + 1}` : String(year);
}

export function buildArchiveUrl(competition) {
  return `${FLASH_SCORE_BASE_URL}/football/${competition.country}/${competition.slug}/archive/`;
}

export function buildCompetitionBaseUrl(competition) {
  return `${FLASH_SCORE_BASE_URL}/football/${competition.country}/${competition.slug}/`;
}
