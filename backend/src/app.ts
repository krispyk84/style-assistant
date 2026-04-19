import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { storageConfig } from './config/storage.js';
import { OUTFIT_STYLE_REFS } from './ai/style-refs-data.js';
import { TIER_STYLE_REFS } from './ai/style-refs-tier-data.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import { closetRouter } from './modules/closet/closet.routes.js';
import { compatibilityRouter } from './modules/compatibility/compatibility.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { outfitsRouter } from './modules/outfits/outfits.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { secondOpinionRouter } from './modules/second-opinion/second-opinion.routes.js';
import { selfieReviewRouter } from './modules/selfie-review/selfie-review.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { tripsRouter } from './modules/trips/trips.routes.js';
import { savedTripsRouter } from './modules/trips/saved-trips.routes.js';
import { tripPlansRouter } from './modules/trips/trip-plans.routes.js';
import { usageRouter } from './modules/usage/usage.routes.js';
import { wardrobeScoreRouter } from './modules/wardrobe-score/wardrobe-score.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  // Uploaded user photos (anchor items, candidate pieces, selfies) are stored in the DB
  // so they survive Render restarts. Serve from imageData when the filesystem file is gone.
  for (const category of ['anchor-item', 'candidate-piece', 'selfie'] as const) {
    app.get(`/media/${category}/:filename`, async (req, res, next) => {
      const filename = req.params.filename as string;
      const filePath = path.join(storageConfig.localDirectory, category, filename);
      try {
        await fs.access(filePath);
        next(); // file exists on disk, let express.static handle it below
        return;
      } catch {
        const db = prisma as any;
        const image = await db.uploadedImage.findFirst({ where: { storageKey: `${category}/${filename}` } });
        if (!image?.imageData) { res.status(404).end(); return; }
        res.setHeader('Content-Type', image.mimeType ?? 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.send(image.imageData);
      }
    });
  }

  // Closet sketch images are stored in the DB (not on the ephemeral filesystem)
  // so they survive server restarts. Serve them directly from sketchImageData.
  // Falls back to the filesystem for legacy sketches that were stored there.
  app.get('/media/closet-sketch/:filename', async (req, res, next) => {
    const filename = req.params.filename as string;
    const filePath = path.join(storageConfig.localDirectory, 'closet-sketch', filename);
    try {
      await fs.access(filePath);
      next(); // file exists on disk, let express.static handle it below
      return;
    } catch {
      // Not on filesystem — serve from DB
      try {
        const storageKey = `closet-sketch/${filename}`;
        const job = await prisma.closetSketchJob.findFirst({ where: { sketchStorageKey: storageKey } });
        if (!job?.sketchImageData) {
          console.error(`[closet-sketch] DB miss for storageKey=${storageKey} job=${JSON.stringify({ id: job?.id, status: job?.status, hasData: !!job?.sketchImageData })}`);
          res.status(404).end();
          return;
        }
        res.setHeader('Content-Type', job.sketchMimeType ?? 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.send(job.sketchImageData);
      } catch (err) {
        console.error(`[closet-sketch] DB query failed for filename=${filename}`, err);
        res.status(500).end();
      }
    }
  });

  app.use(
    '/media',
    express.static(storageConfig.localDirectory, {
      setHeaders(response) {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    })
  );

  app.use(healthRouter);

  // Serves style-reference sketch images for FAL img2img style conditioning.
  // Images are bundled as base64 in style-refs-data.ts — no filesystem dependency.
  // FAL fetches these at generation time via their public https:// URL.
  app.get('/style-refs/:index.jpg', (req, res) => {
    const index = parseInt(req.params.index as string, 10);
    const ref = OUTFIT_STYLE_REFS[index];
    if (!ref) { res.status(404).end(); return; }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(Buffer.from(ref.base64, 'base64'));
  });

  // Tier-specific style references for OpenAI outfit sketch conditioning.
  // Images are bundled as base64 in style-refs-tier-data.ts — no filesystem dependency.
  ['business', 'smart-casual', 'casual'].forEach((tier) => {
    app.get(`/style-refs/${tier}.jpg`, (req, res) => {
      const ref = TIER_STYLE_REFS[tier];
      if (!ref) { res.status(404).end(); return; }
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(Buffer.from(ref.base64, 'base64'));
    });
  });

  const apiRouter = express.Router();
  apiRouter.use(profileRouter);
  apiRouter.use(outfitsRouter);
  apiRouter.use(closetRouter);
  apiRouter.use(compatibilityRouter);
  apiRouter.use(selfieReviewRouter);
  apiRouter.use(secondOpinionRouter);
  apiRouter.use(uploadsRouter);
  apiRouter.use(tripsRouter);
  apiRouter.use(savedTripsRouter);
  apiRouter.use(tripPlansRouter);
  apiRouter.use(usageRouter);
  apiRouter.use(wardrobeScoreRouter);

  app.use(apiRouter);

  if (env.API_PREFIX && env.API_PREFIX !== '/') {
    app.use(env.API_PREFIX, apiRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
