// Imported first by every test file. The tests run on an in-process Postgres,
// so the real connection string is never used; it only has to be present.
process.env.DATABASE_URL ??= 'postgres://unused';
