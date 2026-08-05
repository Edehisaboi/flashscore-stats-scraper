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
  // Tier 1 expansion: additional top flights and the big-five second divisions.
  // Slugs verified against live Flashscore URLs (canonical forms noted where the
  // older/alternate slug now redirects, e.g. primeira-liga -> liga-portugal).
  {
    key: 'championship',
    title: 'Championship',
    country: 'england',
    slug: 'championship',
    seasonType: 'season',
  },
  {
    key: 'eredivisie',
    title: 'Eredivisie',
    country: 'netherlands',
    slug: 'eredivisie',
    seasonType: 'season',
  },
  {
    key: 'liga_portugal',
    title: 'Liga Portugal',
    country: 'portugal',
    slug: 'liga-portugal',
    seasonType: 'season',
  },
  {
    key: 'super_lig',
    title: 'Super Lig',
    country: 'turkey',
    slug: 'super-lig',
    seasonType: 'season',
  },
  {
    key: 'jupiler_pro_league',
    title: 'Jupiler Pro League',
    country: 'belgium',
    slug: 'jupiler-pro-league',
    seasonType: 'season',
  },
  {
    key: 'scottish_premiership',
    title: 'Scottish Premiership',
    country: 'scotland',
    slug: 'premiership',
    seasonType: 'season',
  },
  {
    key: 'bundesliga_2',
    title: '2. Bundesliga',
    country: 'germany',
    slug: '2-bundesliga',
    seasonType: 'season',
  },
  {
    key: 'serie_b',
    title: 'Serie B',
    country: 'italy',
    slug: 'serie-b',
    seasonType: 'season',
  },
  {
    key: 'ligue_2',
    title: 'Ligue 2',
    country: 'france',
    slug: 'ligue-2',
    seasonType: 'season',
  },
  {
    key: 'laliga2',
    title: 'LaLiga 2',
    country: 'spain',
    slug: 'laliga2',
    seasonType: 'season',
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

// Upcoming fixtures live on the current season's fixtures page, reachable
// directly from the competition base URL without resolving a specific season.
export function buildFixturesUrl(competition) {
  return `${buildCompetitionBaseUrl(competition)}fixtures/`;
}

// Best-effort current season start year for fixtures runs (no archive lookup).
// Calendar competitions use the running year; season competitions roll over in
// the summer, and next-season fixtures are published from July, so treat July
// onward as the new season's start year.
export function getCurrentSeasonYear(competition, now = new Date()) {
  const year = now.getUTCFullYear();

  if (competition.seasonType === 'calendar') {
    return year;
  }

  return now.getUTCMonth() >= 6 ? year : year - 1;
}
