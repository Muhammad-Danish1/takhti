ALTER TABLE "wings" ADD COLUMN "gender" text DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "wings" ADD CONSTRAINT "wings_gender_chk" CHECK ("gender" in ('boys', 'girls', 'mixed'));