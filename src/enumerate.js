import { PlaywrightCrawler } from 'crawlee';
import { parseFlashscoreKickoff, cleanText, logInfo, logWarning } from './util.js';

const MAX_SHOW_MORE_CLICKS = 120;

export async function enumerateMatches(options) {
  const {
    resultsUrl,
    competition,
    year,
    proxyConfiguration,
    log,
    maxShowMoreClicks = MAX_SHOW_MORE_CLICKS,
  } = options;
  let matches = [];
  let liveFsign = null;

  const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxConcurrency: 1,
    requestHandlerTimeoutSecs: 180,
    navigationTimeoutSecs: 60,
    launchContext: {
      launchOptions: {
        headless: true,
      },
    },
    preNavigationHooks: [
      async ({ page }) => {
        await page.setExtraHTTPHeaders({
          'accept-language': 'en-US,en;q=0.9',
        });
      },
    ],
    requestHandler: async ({ page }) => {
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
      await dismissConsent(page);
      await exhaustShowMore(page, maxShowMoreClicks, log);

      liveFsign = await extractFsign(page);
      matches = await extractMatches(page, { competition, year });
    },
  });

  await crawler.run([resultsUrl]);

  const dedupedMatches = dedupeMatches(matches);
  logInfo(log, `Enumerated ${dedupedMatches.length} matches from ${competition.title}`, { resultsUrl });

  return {
    matches: dedupedMatches,
    liveFsign,
  };
}

async function dismissConsent(page) {
  const buttons = [
    page.getByRole('button', { name: /accept all/i }),
    page.getByRole('button', { name: /^accept$/i }),
    page.getByRole('button', { name: /i accept/i }),
  ];

  for (const button of buttons) {
    try {
      if (await button.first().isVisible({ timeout: 1500 })) {
        await button.first().click({ timeout: 3000 });
        return;
      }
    } catch {
      // Consent modals differ by region. Absence is fine.
    }
  }
}

async function exhaustShowMore(page, maxClicks, log) {
  let staleClicks = 0;

  for (let clickCount = 0; clickCount < maxClicks; clickCount += 1) {
    const button = await findShowMoreButton(page);

    if (!button) {
      return;
    }

    const beforeCount = await countMatchRows(page);

    try {
      await button.scrollIntoViewIfNeeded({ timeout: 5000 });
      await button.click({ timeout: 10000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(750);
    } catch (error) {
      logWarning(log, 'Failed to click Show more matches button', { message: error.message });
      return;
    }

    const afterCount = await countMatchRows(page);

    if (afterCount <= beforeCount) {
      staleClicks += 1;
      if (staleClicks >= 2) {
        return;
      }
    } else {
      staleClicks = 0;
    }
  }

  logWarning(log, `Stopped after ${maxClicks} Show more clicks; results page may still contain older matches`);
}

async function findShowMoreButton(page) {
  const candidates = [
    page.getByRole('button', { name: /show more/i }).first(),
    page.locator('button:has-text("Show more")').first(),
    page.locator('[class*="wcl-footer__button"]:has-text("Show more")').first(),
    page.locator('[class*="event__more"]:has-text("Show more")').first(),
  ];

  for (const candidate of candidates) {
    try {
      if ((await candidate.count()) > 0 && await candidate.isVisible({ timeout: 1500 })) {
        return candidate;
      }
    } catch {
      // Try the next selector.
    }
  }

  return null;
}

async function countMatchRows(page) {
  return page.locator('[id^="g_"], .event__match').count();
}

async function extractFsign(page) {
  return page.evaluate(() => {
    const haystack = [
      ...Array.from(document.scripts, (script) => `${script.src || ''}\n${script.textContent || ''}`),
      document.documentElement.innerHTML,
    ].join('\n');
    const match = haystack.match(/x-fsign["'\s:=]+([A-Za-z0-9]+)/i);

    return match?.[1] || null;
  }).catch(() => null);
}

async function extractMatches(page, context) {
  const rawMatches = await page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const firstText = (root, selectors) => {
      for (const selector of selectors) {
        const element = root.querySelector(selector);
        const text = clean(element?.textContent);
        if (text) return text;
      }
      return '';
    };
    // Score cells embed the penalty-shootout result in a <sup class="wcl-penaltyScore">
    // (e.g. "1(7)"). Strip it so we keep the regulation score only.
    const scoreText = (root, selectors) => {
      for (const selector of selectors) {
        const element = root.querySelector(selector);
        if (element) {
          const clone = element.cloneNode(true);
          clone.querySelectorAll('[class*="penaltyScore"], sup').forEach((node) => node.remove());
          const text = clean(clone.textContent);
          if (text) return text;
        }
      }
      return '';
    };
    const hasPenaltyShootout = (root) => Boolean(root.querySelector('[class*="penaltyScore"]'));
    const allTexts = (root, selectors) => {
      const values = [];
      for (const selector of selectors) {
        for (const element of root.querySelectorAll(selector)) {
          const text = clean(element.textContent);
          if (text) values.push(text);
        }
      }
      return values;
    };
    const absoluteUrl = (href) => {
      try {
        return new URL(href, location.href).href;
      } catch {
        return href || '';
      }
    };
    const teamIdFromHref = (href) => {
      const match = String(href || '').match(/\/team\/[^/]+\/([^/#?]+)/i);
      return match?.[1] || '';
    };
    const teamIdFromParticipant = (row, selector, teamName) => {
      const participant = row.querySelector(selector);
      const directLink = participant?.closest('a[href*="/team/"]') || participant?.querySelector?.('a[href*="/team/"]');
      if (directLink) {
        return teamIdFromHref(directLink.getAttribute('href'));
      }

      const normalizedName = clean(teamName).toLowerCase();
      for (const link of row.querySelectorAll('a[href*="/team/"]')) {
        if (clean(link.textContent).toLowerCase() === normalizedName) {
          return teamIdFromHref(link.getAttribute('href'));
        }
      }
      return '';
    };
    const roundFromPreviousHeaders = (row) => {
      let node = row.previousElementSibling;

      while (node) {
        const className = String(node.className || '');
        const text = clean(node.textContent);
        if (text && /round|header|stage/i.test(className)) {
          return text;
        }
        node = node.previousElementSibling;
      }

      const group = row.closest('[class*="event"]');
      const header = group?.querySelector('[class*="event__round"], [class*="event__header"]');
      return clean(header?.textContent);
    };
    const teamIdsFromMatchUrl = (url) => {
      const parts = String(url || '').match(/\/match\/[^/]+\/([^/]+)\/([^/]+)\/(?:[?#]|$)/);
      const lastToken = (segment) => {
        const tokens = String(segment || '').split('-').filter(Boolean);
        return tokens.length ? tokens[tokens.length - 1] : '';
      };
      return parts ? [lastToken(parts[1]), lastToken(parts[2])] : ['', ''];
    };
    const midFromRow = (row, matchUrl) => {
      const idMatch = String(row.id || '').match(/g_\d+_([A-Za-z0-9]+)/);
      const queryMatch = String(matchUrl || '').match(/[?&]mid=([^&#]+)/i);
      const pathMatch = String(matchUrl || '').match(/\/match\/(?:[^/]+\/)?([A-Za-z0-9]{6,})(?:[/?#]|$)/i);

      return idMatch?.[1] || queryMatch?.[1] || pathMatch?.[1] || '';
    };
    const rows = Array.from(document.querySelectorAll('[id^="g_"], .event__match'));

    return rows.map((row) => {
      const matchLink = row.querySelector('a[href*="/match/"], a[href*="mid="]');
      const matchUrl = absoluteUrl(matchLink?.getAttribute('href') || '');
      const [homeIdFromUrl, awayIdFromUrl] = teamIdsFromMatchUrl(matchUrl);
      const homeTeam = firstText(row, [
        '[class*="homeParticipant"] [class*="wcl-name"]',
        '[class*="homeParticipant"]',
        '.event__homeParticipant',
        '.event__participant--home',
      ]);
      const awayTeam = firstText(row, [
        '[class*="awayParticipant"] [class*="wcl-name"]',
        '[class*="awayParticipant"]',
        '.event__awayParticipant',
        '.event__participant--away',
      ]);
      const homeParts = allTexts(row, [
        '.event__part--home',
        '[class*="part--home"]',
      ]);
      const awayParts = allTexts(row, [
        '.event__part--away',
        '[class*="part--away"]',
      ]);
      const homeScoreRaw = scoreText(row, [
        '.event__score--home',
        '[class*="score--home"]',
      ]);
      const awayScoreRaw = scoreText(row, [
        '.event__score--away',
        '[class*="score--away"]',
      ]);
      // Finished-results rows carry no status text (only date + score); the
      // date lives in event__stageTime, so avoid a broad [class*="stage"] match
      // that would capture the date as a status.
      const status = firstText(row, [
        '.event__stage--block',
        '.event__stage',
      ]);
      // The stageTime wrapper appends a stage marker (e.g. "Pen"/"AET") after the
      // date; read the inner date span so kickoff stays a clean "DD.MM.YYYY".
      const kickoff = firstText(row, [
        '[class*="dateContent"]',
        '[class*="stageTime"]',
        '.event__stageTime',
        '.event__time',
      ]);

      return {
        mid: midFromRow(row, matchUrl),
        matchUrl,
        status,
        kickoff,
        round: roundFromPreviousHeaders(row),
        homeTeam,
        homeTeamId: homeIdFromUrl || teamIdFromParticipant(row, '[class*="homeParticipant"], .event__participant--home', homeTeam),
        awayTeam,
        awayTeamId: awayIdFromUrl || teamIdFromParticipant(row, '[class*="awayParticipant"], .event__participant--away', awayTeam),
        homeScoreRaw,
        awayScoreRaw,
        homeParts,
        awayParts,
      };
    }).filter((match) => match.mid && (match.homeTeam || match.awayTeam));
  });

  return rawMatches.map((match) => normalizeEnumeratedMatch(match, context));
}

function normalizeEnumeratedMatch(match, context) {
  const status = cleanText(match.status);
  const isExtraTimeOrPens = /after extra|extra time|\baet\b|after penalties|penalties|pen\./i.test(status);

  return {
    ...match,
    status,
    kickoff: cleanText(match.kickoff),
    dateUtc: parseFlashscoreKickoff(match.kickoff, context.competition, context.year),
    homeScoreHt: numericPart(match.homeParts?.[0]),
    awayScoreHt: numericPart(match.awayParts?.[0]),
    homeScoreFt: isExtraTimeOrPens ? regulationScore(match.homeScoreRaw, match.homeParts) : match.homeScoreRaw,
    awayScoreFt: isExtraTimeOrPens ? regulationScore(match.awayScoreRaw, match.awayParts) : match.awayScoreRaw,
    scoreInfo: isExtraTimeOrPens ? 'AET/PEN detected in listing status' : '',
  };
}

function regulationScore(rawScore, parts = []) {
  const first = numericPart(parts[0]);
  const second = numericPart(parts[1]);

  if (first !== '' && second !== '') {
    return String(first + second);
  }

  return rawScore;
}

function numericPart(value) {
  const match = String(value ?? '').match(/-?\d+/);
  return match ? Number.parseInt(match[0], 10) : '';
}

function dedupeMatches(matches) {
  return [...new Map(matches.map((match) => [match.mid, match])).values()];
}
