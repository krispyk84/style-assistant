#!/usr/bin/env node
// Production-build smoke test — complements src/__tests__/app.smoke.test.ts.
//
// The Vitest smoke test runs the app through tsx's on-the-fly TS transform,
// which is close to but not identical to what Render actually runs: Render's
// buildCommand does `npm run build` (prisma generate + tsc) and its
// startCommand runs the COMPILED output directly (`node dist/index.js`, via
// `npm run start:migrate`). This script exercises that exact path — build,
// then spawn the real compiled entrypoint as a real child process — so a
// failure that only manifests post-compilation (bad emitted import paths,
// ESM/CJS interop, a build step silently producing stale/partial output)
// would surface here even if it never shows up in the tsx-transformed test.
//
// It boots the real compiled app with PORT=0 (OS-assigned ephemeral port, so
// it never collides with anything already running), waits for the real
// "listening" log line, then sends SIGTERM and confirms a clean exit — no
// production credentials, no destructive calls, nothing left running after.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// env.ts requires PORT to be a positive integer (0 — "any free port" — isn't
// accepted), so an ephemeral port is picked here instead and handed to the
// child via env, rather than asking the child to self-assign one.
async function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LISTEN_TIMEOUT_MS = 20_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const storageDir = path.join(backendRoot, '.smoke-build-storage');

function log(message) {
  process.stdout.write(`[smoke-build] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[smoke-build] FAILED: ${message}\n`);
  process.exit(1);
}

if (!process.argv.includes('--skip-build')) {
  log('Building (prisma generate + tsc) — the same buildCommand Render runs...');
  const build = spawnSync('npm', ['run', 'build'], { cwd: backendRoot, stdio: 'inherit' });
  if (build.status !== 0) {
    fail('npm run build failed — see output above.');
  }
} else {
  log('Skipping build (--skip-build passed); using existing dist/.');
}

mkdirSync(storageDir, { recursive: true });

const freePort = await findFreePort();

// Dummy values mirroring vitest.config.ts's test env — no production
// credentials, no reachable external services required.
const childEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(freePort),
  DATABASE_URL: 'postgresql://smoke:smoke@localhost:5432/smoke',
  OPENAI_API_KEY: 'smoke-openai-key',
  STORAGE_PUBLIC_BASE_URL: 'http://localhost:4000',
  STORAGE_LOCAL_DIR: storageDir,
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'smoke-supabase-anon-key',
};

log(`Starting the compiled entrypoint (node dist/index.js) on ephemeral port ${freePort}...`);
const child = spawn('node', ['dist/index.js'], { cwd: backendRoot, env: childEnv });

let stdout = '';
let stderr = '';
let settled = false;

const listenTimer = setTimeout(() => {
  if (settled) return;
  settled = true;
  child.kill('SIGKILL');
  fail(
    `Did not see the "listening" log within ${LISTEN_TIMEOUT_MS}ms.\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`
  );
}, LISTEN_TIMEOUT_MS);

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString();
  if (!settled && stdout.includes('Style Assistant API listening')) {
    settled = true;
    clearTimeout(listenTimer);
    log('App booted and started listening — sending SIGTERM to confirm a clean shutdown...');

    const shutdownTimer = setTimeout(() => {
      child.kill('SIGKILL');
      fail(`Process did not exit within ${SHUTDOWN_TIMEOUT_MS}ms of SIGTERM.`);
    }, SHUTDOWN_TIMEOUT_MS);

    child.once('exit', (code) => {
      clearTimeout(shutdownTimer);
      if (code === 0) {
        log('Clean exit after SIGTERM. Compiled app constructs and serves without throwing.');
        process.exit(0);
      } else {
        fail(`Process exited with code ${code} after SIGTERM instead of shutting down cleanly.\n--- stderr ---\n${stderr}`);
      }
    });

    child.kill('SIGTERM');
  }
});

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

child.once('exit', (code) => {
  if (settled) return;
  settled = true;
  clearTimeout(listenTimer);
  fail(`Compiled app exited on its own (code ${code}) before it started listening.\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
});
