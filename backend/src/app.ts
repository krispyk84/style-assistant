import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';

import { env } from './config/env.js';
import { storageConfig } from './config/storage.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import { compatibilityRouter } from './modules/compatibility/compatibility.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { outfitsRouter } from './modules/outfits/outfits.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { selfieReviewRouter } from './modules/selfie-review/selfie-review.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use('/media', express.static(storageConfig.localDirectory));

  app.use(healthRouter);

  const apiRouter = express.Router();
  apiRouter.use(profileRouter);
  apiRouter.use(outfitsRouter);
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
