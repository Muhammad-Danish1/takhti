CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"source" text NOT NULL,
	"request_id" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"org_id" uuid,
	"role_key" text,
	"permission" text,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("org_id","role_key","permission")
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"admission_no" text NOT NULL,
	"full_name" text NOT NULL,
	"father_name" text NOT NULL,
	"gender" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"b_form_no" text,
	"section_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"admitted_on" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("org_id","entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_code_uq" ON "branches" ("org_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "students_admission_no_uq" ON "students" ("org_id","admission_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "students_section_idx" ON "students" ("org_id","section_id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
CREATE POLICY "audit_log_insert" ON "audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("audit_log"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "audit_log_read" ON "audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("audit_log"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "branches_org" ON "branches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("branches"."org_id" = (select app.org_id())) WITH CHECK ("branches"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "role_permissions_org" ON "role_permissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("role_permissions"."org_id" = (select app.org_id())) WITH CHECK ("role_permissions"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "students_org" ON "students" AS PERMISSIVE FOR ALL TO "authenticated" USING ("students"."org_id" = (select app.org_id())) WITH CHECK ("students"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "students_branch" ON "students" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((select app.all_branches()) or "students"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK (((select app.all_branches()) or "students"."branch_id" = any ((select app.branch_ids())::uuid[])));