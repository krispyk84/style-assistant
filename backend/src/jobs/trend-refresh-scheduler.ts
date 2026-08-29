import { logger } from '../config/logger.js';
import { seasonalTrendsService } from '../modules/seasonal-trends/seasonal-trends.service.js';
import { haircutTrendsService } from '../modules/haircut-trends/haircut-trends.service.js';

// Server-side "auto load at the first opportunity after a new season starts"
// refresh — decouples generation from any single user opening a report.
// ensureCurrentProfile() is a cheap DB-read no-op whenever a valid profile
// already exists for the current season, so polling this often costs nothing
// extra on every tick except the one right after a season boundary, when it
// actually fires the Gemini call. Only covers Northern Hemisphere by default
// (this app's documented fallback) — a user's own device still calls ensure()
// with their real hemisphere when they open a report, so Southern-hemisphere
// users aren't left uncovered, just not pre-warmed by this job.
const CHECK_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
const STARTUP_DELAY_MS = 1000 * 10;

function runCheck() {
  try {
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'womenswear', hemisphere: 'northern' });
    haircutTrendsService.ensureCurrentProfile({ hemisphere: 'northern' });
  } catch (error) {
    logger.error({ error }, 'Trend refresh scheduler: check failed to fire');
  }
}

export function startTrendRefreshScheduler() {
  setTimeout(runCheck, STARTUP_DELAY_MS);
  setInterval(runCheck, CHECK_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS }, 'Trend refresh scheduler started');
}
