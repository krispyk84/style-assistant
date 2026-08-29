import { logger } from '../config/logger.js';
import { seasonalTrendsService } from '../modules/seasonal-trends/seasonal-trends.service.js';
import { trendSketchService } from '../modules/seasonal-trends/trend-sketch.service.js';
import { haircutTrendsService } from '../modules/haircut-trends/haircut-trends.service.js';
import { haircutService } from '../modules/haircut/haircut.service.js';

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

// Separate, much more frequent sweep for orphaned/failed trend sketches — a
// deploy (or any restart) mid-generation kills that in-flight work since it
// only ever existed in memory, leaving the row stuck at "pending" forever
// with nothing else to retry it. This is cheap (a DB read) whenever there's
// nothing stuck, so a short interval costs effectively nothing.
const SKETCH_RETRY_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes
const SKETCH_RETRY_STARTUP_DELAY_MS = 1000 * 30;

function runCheck() {
  try {
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    seasonalTrendsService.ensureCurrentProfile({ fashionGender: 'womenswear', hemisphere: 'northern' });
    haircutTrendsService.ensureCurrentProfile({ fashionGender: 'menswear', hemisphere: 'northern' });
    haircutTrendsService.ensureCurrentProfile({ fashionGender: 'womenswear', hemisphere: 'northern' });
  } catch (error) {
    logger.error({ error }, 'Trend refresh scheduler: check failed to fire');
  }

  // Piggybacks on the same 6-hour tick — trend staleness changes slowly, so
  // this doesn't need its own faster interval like the stuck-sketch retry does.
  trendSketchService.pruneStaleSketches().catch((error) => {
    logger.error({ error }, 'Trend sketch prune sweep failed to fire');
  });
}

function runSketchRetrySweep() {
  trendSketchService.retryStuckSketches().catch((error) => {
    logger.error({ error }, 'Trend sketch retry sweep failed to fire');
  });
  // Same failure mode as trend sketches (a deploy mid-generation orphans the
  // in-flight image edit), same fix — piggyback on the same interval.
  haircutService.retryStuckAngleShots().catch((error) => {
    logger.error({ error }, 'Haircut angle shot retry sweep failed to fire');
  });
}

export function startTrendRefreshScheduler() {
  setTimeout(runCheck, STARTUP_DELAY_MS);
  setInterval(runCheck, CHECK_INTERVAL_MS);
  setTimeout(runSketchRetrySweep, SKETCH_RETRY_STARTUP_DELAY_MS);
  setInterval(runSketchRetrySweep, SKETCH_RETRY_INTERVAL_MS);
  logger.info({ intervalMs: CHECK_INTERVAL_MS, sketchRetryIntervalMs: SKETCH_RETRY_INTERVAL_MS }, 'Trend refresh scheduler started');
}
