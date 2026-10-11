/*
 * The worker process:  pnpm worker
 *
 * It runs beside the web app, against the same database. Importing `@takhti/core` registers every
 * job and schedule the product defines; this file adds nothing but the process around them.
 */
import { env, logger } from '@takhti/core';
import { closeDatabase } from '@takhti/db';
import { createWorker } from './worker';

// Refuses to start with a missing or malformed setting, and says which one.
env();

const worker = createWorker({
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  perOrgLimit: Number(process.env.WORKER_PER_ORG_LIMIT ?? 2),
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger().info({ signal }, 'stopping: no new jobs will be taken');
  await worker.stop();
  await closeDatabase().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
// A fault outside any job must not take the running jobs down with it: note it and carry on.
process.on('unhandledRejection', (reason) =>
  logger().error(
    { err: reason instanceof Error ? reason.message : String(reason) },
    'unhandled rejection in the worker',
  ),
);
process.on('uncaughtException', (error) => {
  logger().fatal(
    { err: error.message, stack: error.stack },
    'uncaught exception in the worker; stopping so that a clean process can take over',
  );
  void shutdown('uncaughtException');
});

await worker.start();
