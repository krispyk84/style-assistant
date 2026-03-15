import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './db/prisma.js';

async function bootstrap() {
  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        apiPrefix: env.API_PREFIX,
        environment: env.NODE_ENV,
      },
      'Style Assistant API listening'
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down API');
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch(async (error) => {
  logger.error({ error }, 'Failed to bootstrap API');
  await prisma.$disconnect();
  process.exit(1);
});
