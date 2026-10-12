DROP INDEX "account_mappings_key_branch_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "account_mappings_key_branch_uq" ON "account_mappings" ("org_id","key",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
DROP INDEX "statutory_filings_kind_branch_period_from_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "statutory_filings_kind_branch_period_from_uq" ON "statutory_filings" ("org_id","kind",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid),"period_from") WHERE "deleted_at" is null;