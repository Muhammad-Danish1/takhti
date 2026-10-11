import './setup-env';
import { preparePgliteTemplate, preparePostgresTemplate, testEngine } from './test-db';

/**
 * Runs once before any test file: prepares the migrated database every file starts from,
 * so the migrations are applied once per run, not once per file.
 */
export default async function setup(): Promise<void> {
  if (testEngine() === 'postgres') await preparePostgresTemplate();
  else await preparePgliteTemplate();
}
