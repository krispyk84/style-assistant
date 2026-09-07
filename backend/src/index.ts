import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './db/prisma.js';
import { startTrendRefreshScheduler } from './jobs/trend-refresh-scheduler.js';

// Observability/backstop only — every intentionally fire-and-forget async
// call in the codebase now has its own .catch() at the call site, so this
// should never fire in practice. If it does, something escaped that
// handling and the process is in an unknown state; log for visibility and
// exit rather than silently continuing on the assumption that state is
// still consistent (the process manager — e.g. Render — restarts it).
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection — exiting');
  process.exit(1);
});

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

  startTrendRefreshScheduler();

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
