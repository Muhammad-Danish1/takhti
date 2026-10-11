/*
 * The parts of the seed that need only a database: used by the tests and by `pnpm db:verify-seed`.
 * The command that seeds a developer's machine is `run.ts`.
 * The seeded password is deliberately not exported from here; see `accounts.ts`.
 */
export {
  alnoorAccounts,
  platformAccounts,
  roshanAccounts,
  seedAccounts,
  type SeedAccount,
} from './accounts';
export { seedId, type SeedRun, type SeedSize } from './context';
export { seededSchools, seedSchool } from './schools';
export { seedCheckCount, verifySeed } from './verify';
