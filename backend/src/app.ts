import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { storageConfig } from './config/storage.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import { closetRouter } from './modules/closet/closet.routes.js';
import { compatibilityRouter } from './modules/compatibility/compatibility.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { outfitsRouter } from './modules/outfits/outfits.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { selfieReviewRouter } from './modules/selfie-review/selfie-review.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';

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
      const storageKey = `closet-sketch/${filename}`;
      const job = await prisma.closetSketchJob.findFirst({ where: { sketchStorageKey: storageKey } });
      if (!job?.sketchImageData) { res.status(404).end(); return; }
      res.setHeader('Content-Type', job.sketchMimeType ?? 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(job.sketchImageData);
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

  const apiRouter = express.Router();
  apiRouter.use(profileRouter);
  apiRouter.use(outfitsRouter);
  apiRouter.use(closetRouter);
  apiRouter.use(compatibilityRouter);
  apiRouter.use(selfieReviewRouter);
  apiRouter.use(uploadsRouter);

  app.use(apiRouter);

  if (env.API_PREFIX && env.API_PREFIX !== '/') {
    app.use(env.API_PREFIX, apiRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
