// Order matters only for readability: tables register themselves as they are imported.
// Wave 0 — M02 organisation, M03 identity, M00 shared kernel, M01 platform.
export * from './organisation/orgs.table';
export * from './organisation/branches.table';
export * from './organisation/organisation.table';
export * from './identity/identity.table';
export * from './shared/files.table';
export * from './shared/queue.table';
export * from './shared/workflow.table';
export * from './shared/sync.table';
export * from './platform/platform.table';
// Waves 1 onwards are written by `pnpm scaffold` from the module specifications.
export * from './generated';
