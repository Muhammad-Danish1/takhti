CREATE TABLE "dashboard_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"portal" text NOT NULL,
	"role_key" text,
	"user_id" uuid,
	"widgets" jsonb NOT NULL,
	CONSTRAINT "dashboard_layouts_portal_chk" CHECK ("portal" in ('hq', 'school', 'teach', 'family', 'learn')),
	CONSTRAINT "dashboard_layouts_user_id_one_owner" CHECK (("role_key" is null) <> ("user_id" is null))
);
--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "kpi_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kpi_key" text NOT NULL,
	"branch_id" uuid,
	"snapshot_date" date NOT NULL,
	"value" numeric(18,4) NOT NULL,
	"numerator" numeric(18,4),
	"denominator" numeric(18,4),
	"dims" jsonb DEFAULT '{}' NOT NULL,
	"dims_key" text GENERATED ALWAYS AS (("kpi_snapshots"."dims")::text) STORED
);
--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"report_key" text NOT NULL,
	"user_id" uuid,
	"schedule_id" uuid,
	"params" jsonb NOT NULL,
	"branch_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"row_count" integer,
	"duration_ms" integer,
	"output" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	CONSTRAINT "report_runs_output_chk" CHECK ("output" in ('screen', 'pdf', 'xlsx', 'csv', 'ai')),
	CONSTRAINT "report_runs_status_chk" CHECK ("status" in ('ok', 'failed', 'refused'))
);
--> statement-breakpoint
ALTER TABLE "report_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"saved_report_id" uuid NOT NULL,
	"frequency" text NOT NULL,
	"weekday" integer,
	"day_of_month" integer,
	"send_time" time NOT NULL,
	"format" text NOT NULL,
	"recipient_user_ids" uuid[] NOT NULL,
	"run_as_user_id" uuid NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_status" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "report_schedules_frequency_chk" CHECK ("frequency" in ('daily', 'weekly', 'monthly', 'term_end')),
	CONSTRAINT "report_schedules_format_chk" CHECK ("format" in ('pdf', 'xlsx', 'csv')),
	CONSTRAINT "report_schedules_last_status_chk" CHECK ("last_status" in ('ok', 'failed', 'skipped')),
	CONSTRAINT "report_schedules_day_of_month_range" CHECK ("day_of_month" between 1 and 28),
	CONSTRAINT "report_schedules_recipient_user_ids_some" CHECK (cardinality("recipient_user_ids") >= 1)
);
--> statement-breakpoint
ALTER TABLE "report_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"report_key" text NOT NULL,
	"name" text NOT NULL,
	"params" jsonb NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"shared_role_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"kpi_key" text NOT NULL,
	"condition" text NOT NULL,
	"threshold" numeric(18,4) NOT NULL,
	"compare_window_days" integer DEFAULT 7 NOT NULL,
	"branch_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"recipient_role_keys" text[] NOT NULL,
	"cooldown_days" integer DEFAULT 7 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "alert_rules_condition_chk" CHECK ("condition" in ('below', 'above', 'drops_by_percent', 'rises_by_percent', 'below_target_by_percent')),
	CONSTRAINT "alert_rules_severity_chk" CHECK ("severity" in ('info', 'warning', 'critical'))
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"rule_id" uuid NOT NULL,
	"branch_id" uuid,
	"kpi_key" text NOT NULL,
	"raised_on" date NOT NULL,
	"value" numeric(18,4) NOT NULL,
	"compared_to" numeric(18,4),
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"note" text,
	"resolved_on" date,
	CONSTRAINT "alerts_severity_chk" CHECK ("severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "alerts_status_chk" CHECK ("status" in ('open', 'acknowledged', 'resolved', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "branch_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"kpi_key" text NOT NULL,
	"period_kind" text NOT NULL,
	"period_start" date NOT NULL,
	"target" numeric(18,4) NOT NULL,
	"note" text,
	"set_by" uuid NOT NULL,
	CONSTRAINT "branch_targets_period_kind_chk" CHECK ("period_kind" in ('month', 'term', 'year'))
);
--> statement-breakpoint
ALTER TABLE "branch_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "executive_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"week_start" date NOT NULL,
	"content" jsonb NOT NULL,
	"narrative" text,
	"narrative_source" text DEFAULT 'template' NOT NULL,
	"sent_at" timestamp with time zone,
	"recipient_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	CONSTRAINT "executive_digests_narrative_source_chk" CHECK ("narrative_source" in ('none', 'template', 'ai')),
	CONSTRAINT "executive_digests_week_start_monday" CHECK (extract(isodow from "week_start") = 1)
);
--> statement-breakpoint
ALTER TABLE "executive_digests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hq_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid,
	"kpi_key" text,
	"note_date" date NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid NOT NULL,
	"is_shared_with_branch" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hq_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"rule_key" text NOT NULL,
	"branch_id" uuid,
	"severity" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"detail" jsonb NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	CONSTRAINT "activity_flags_severity_chk" CHECK ("severity" in ('low', 'medium', 'high')),
	CONSTRAINT "activity_flags_status_chk" CHECK ("status" in ('open', 'reviewed_ok', 'confirmed', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "activity_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"portal" text NOT NULL,
	"title" text,
	"guardian_id" uuid,
	"context" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone,
	"is_flagged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ai_conversations_surface_chk" CHECK ("surface" in ('assistant', 'ask_data', 'study_help', 'parent_chatbot')),
	CONSTRAINT "ai_conversations_portal_chk" CHECK ("portal" in ('hq', 'school', 'teach', 'family', 'learn', 'whatsapp')),
	CONSTRAINT "ai_conversations_status_chk" CHECK ("status" in ('open', 'handed_over', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"run_id" uuid,
	"output_id" uuid,
	"message_id" uuid,
	"user_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"reason" text,
	"comment" text,
	CONSTRAINT "ai_feedback_rating_chk" CHECK ("rating" in ('good', 'poor')),
	CONSTRAINT "ai_feedback_reason_chk" CHECK ("reason" in ('wrong', 'unhelpful', 'unsafe', 'tone', 'language', 'other'))
);
--> statement-breakpoint
ALTER TABLE "ai_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"previews" jsonb DEFAULT '[]' NOT NULL,
	"run_id" uuid,
	CONSTRAINT "ai_messages_role_chk" CHECK ("role" in ('user', 'assistant', 'tool'))
);
--> statement-breakpoint
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"feature" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"branch_id" uuid,
	"requested_by" uuid NOT NULL,
	"run_id" uuid,
	"input_summary" jsonb NOT NULL,
	"output" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"final_value" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_outputs_status_chk" CHECK ("status" in ('pending', 'ready', 'accepted', 'edited', 'rejected', 'expired', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ai_outputs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"feature" text NOT NULL,
	"user_id" uuid,
	"branch_id" uuid,
	"conversation_id" uuid,
	"model" text NOT NULL,
	"mode" text DEFAULT 'interactive' NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"tool_calls" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"batch_id" text,
	CONSTRAINT "ai_runs_mode_chk" CHECK ("mode" in ('interactive', 'batch')),
	CONSTRAINT "ai_runs_status_chk" CHECK ("status" in ('ok', 'refused', 'unavailable', 'invalid_output', 'over_budget', 'error')),
	CONSTRAINT "ai_runs_cost_min" CHECK ("cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"features" jsonb DEFAULT '{}' NOT NULL,
	"monthly_budget" bigint DEFAULT 0 NOT NULL,
	"alert_at_percent" integer DEFAULT 80 NOT NULL,
	"languages" text[] DEFAULT '{en,ur}'::text[] NOT NULL,
	"tone" text DEFAULT 'warm' NOT NULL,
	"chatbot_hours" jsonb DEFAULT '{}' NOT NULL,
	"chatbot_handover_role" text DEFAULT 'receptionist' NOT NULL,
	"student_assistant_supervisor_role" text DEFAULT 'coordinator' NOT NULL,
	CONSTRAINT "ai_settings_tone_chk" CHECK ("tone" in ('formal', 'warm')),
	CONSTRAINT "ai_settings_monthly_budget_min" CHECK ("monthly_budget" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"usage_date" date NOT NULL,
	"feature" text NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_daily_cost_min" CHECK ("cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "defaulter_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"score_date" date NOT NULL,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"factors" jsonb NOT NULL,
	"suggested_action" text NOT NULL,
	CONSTRAINT "defaulter_scores_band_chk" CHECK ("band" in ('low', 'medium', 'high')),
	CONSTRAINT "defaulter_scores_suggested_action_chk" CHECK ("suggested_action" in ('none', 'early_reminder', 'call', 'meeting', 'instalment_plan')),
	CONSTRAINT "defaulter_scores_score_range" CHECK ("score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "defaulter_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"heading" text,
	"page" integer,
	"content" text NOT NULL,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("knowledge_chunks"."heading", '') || ' ' || "knowledge_chunks"."content")) STORED,
	"embedding" real[]
);
--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid,
	"body" text,
	"language" text DEFAULT 'en' NOT NULL,
	"grade_subject_id" uuid,
	"audience" text NOT NULL,
	"branch_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"pages" integer,
	"error" text,
	"uploaded_by" uuid NOT NULL,
	CONSTRAINT "knowledge_documents_kind_chk" CHECK ("kind" in ('textbook', 'syllabus', 'policy', 'handbook', 'faq', 'past_paper', 'other')),
	CONSTRAINT "knowledge_documents_language_chk" CHECK ("language" in ('en', 'ur', 'both')),
	CONSTRAINT "knowledge_documents_audience_chk" CHECK ("audience" in ('staff', 'parents', 'students')),
	CONSTRAINT "knowledge_documents_status_chk" CHECK ("status" in ('uploaded', 'processing', 'ready', 'failed', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"reviewed_on" date NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"follow_up_on" date,
	CONSTRAINT "risk_reviews_decision_chk" CHECK ("decision" in ('monitor', 'talk_to_student', 'call_guardian', 'refer_counsellor', 'fee_support', 'no_action'))
);
--> statement-breakpoint
ALTER TABLE "risk_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score_date" date NOT NULL,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"factors" jsonb NOT NULL,
	"change" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "risk_scores_band_chk" CHECK ("band" in ('low', 'watch', 'high')),
	CONSTRAINT "risk_scores_score_range" CHECK ("score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "risk_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "topic_mastery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"grade_subject_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"student_id" uuid,
	"marks_obtained" numeric(8,2) NOT NULL,
	"marks_available" numeric(8,2) NOT NULL,
	"mastery_percent" numeric(5,2) NOT NULL,
	"papers_counted" integer NOT NULL,
	"updated_on" date NOT NULL,
	CONSTRAINT "topic_mastery_marks_available_pos" CHECK ("marks_available" > 0)
);
--> statement-breakpoint
ALTER TABLE "topic_mastery" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_layouts_portal_role_key_uq" ON "dashboard_layouts" ("org_id","portal","role_key") WHERE "deleted_at" is null and "role_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_layouts_portal_user_uq" ON "dashboard_layouts" ("org_id","portal","user_id") WHERE "deleted_at" is null and "user_id" is not null;--> statement-breakpoint
CREATE INDEX "dashboard_layouts_user_id_fk_idx" ON "dashboard_layouts" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_snapshots_kpi_key_branch_snapshot_date_dims_key_uq" ON "kpi_snapshots" ("org_id","kpi_key",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid),"snapshot_date",coalesce("dims_key", '')) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "kpi_snapshots_kpi_key_snapshot_date_idx" ON "kpi_snapshots" ("org_id","kpi_key","snapshot_date");--> statement-breakpoint
CREATE INDEX "kpi_snapshots_branch_id_fk_idx" ON "kpi_snapshots" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "report_runs_report_key_created_at_idx" ON "report_runs" ("org_id","report_key","created_at");--> statement-breakpoint
CREATE INDEX "report_runs_user_created_at_idx" ON "report_runs" ("org_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "report_runs_user_id_fk_idx" ON "report_runs" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "report_runs_schedule_id_fk_idx" ON "report_runs" ("schedule_id") WHERE "schedule_id" is not null;--> statement-breakpoint
CREATE INDEX "report_schedules_created_by_fk_idx" ON "report_schedules" ("created_by");--> statement-breakpoint
CREATE INDEX "report_schedules_saved_report_id_fk_idx" ON "report_schedules" ("saved_report_id");--> statement-breakpoint
CREATE INDEX "report_schedules_run_as_user_id_fk_idx" ON "report_schedules" ("run_as_user_id");--> statement-breakpoint
CREATE INDEX "saved_reports_user_id_fk_idx" ON "saved_reports" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_rule_branch_raised_on_uq" ON "alerts" ("rule_id",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid),"raised_on") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "alerts_status_severity_idx" ON "alerts" ("org_id","status","severity");--> statement-breakpoint
CREATE INDEX "alerts_branch_id_fk_idx" ON "alerts" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "alerts_acknowledged_by_fk_idx" ON "alerts" ("acknowledged_by") WHERE "acknowledged_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_targets_branch_kpi_key_period_kind_period_start_uq" ON "branch_targets" ("branch_id","kpi_key","period_kind","period_start") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "branch_targets_set_by_fk_idx" ON "branch_targets" ("set_by");--> statement-breakpoint
CREATE UNIQUE INDEX "executive_digests_week_start_uq" ON "executive_digests" ("org_id","week_start") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hq_notes_branch_id_fk_idx" ON "hq_notes" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "hq_notes_author_id_fk_idx" ON "hq_notes" ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "activity_flags_rule_key_subject_type_subject_period_from_uq" ON "activity_flags" ("rule_key","subject_type","subject_id","period_from") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "activity_flags_branch_id_fk_idx" ON "activity_flags" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "activity_flags_reviewed_by_fk_idx" ON "activity_flags" ("reviewed_by") WHERE "reviewed_by" is not null;--> statement-breakpoint
CREATE INDEX "ai_conversations_user_last_message_at_idx" ON "ai_conversations" ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "ai_conversations_guardian_id_fk_idx" ON "ai_conversations" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_feedback_run_id_fk_idx" ON "ai_feedback" ("run_id") WHERE "run_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_feedback_output_id_fk_idx" ON "ai_feedback" ("output_id") WHERE "output_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_feedback_message_id_fk_idx" ON "ai_feedback" ("message_id") WHERE "message_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_feedback_user_id_fk_idx" ON "ai_feedback" ("user_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_created_at_idx" ON "ai_messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_messages_user_id_fk_idx" ON "ai_messages" ("user_id");--> statement-breakpoint
CREATE INDEX "ai_messages_run_id_fk_idx" ON "ai_messages" ("run_id") WHERE "run_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_outputs_target_type_target_idx" ON "ai_outputs" ("org_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "ai_outputs_requested_by_status_idx" ON "ai_outputs" ("org_id","requested_by","status");--> statement-breakpoint
CREATE INDEX "ai_outputs_branch_id_fk_idx" ON "ai_outputs" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_outputs_requested_by_fk_idx" ON "ai_outputs" ("requested_by");--> statement-breakpoint
CREATE INDEX "ai_outputs_run_id_fk_idx" ON "ai_outputs" ("run_id") WHERE "run_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_outputs_decided_by_fk_idx" ON "ai_outputs" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "ai_runs_feature_created_at_idx" ON "ai_runs" ("org_id","feature","created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs" ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_user_id_fk_idx" ON "ai_runs" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_runs_branch_id_fk_idx" ON "ai_runs" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_runs_conversation_id_fk_idx" ON "ai_runs" ("conversation_id") WHERE "conversation_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_settings_org_uq" ON "ai_settings" ("org_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_daily_usage_date_feature_uq" ON "ai_usage_daily" ("org_id","usage_date","feature") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "defaulter_scores_family_score_date_uq" ON "defaulter_scores" ("family_id","score_date") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "defaulter_scores_branch_id_fk_idx" ON "defaulter_scores" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_chunks_document_ordinal_uq" ON "knowledge_chunks" ("document_id","ordinal") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "knowledge_chunks_search_gin" ON "knowledge_chunks" USING gin ("search");--> statement-breakpoint
CREATE INDEX "knowledge_documents_file_id_fk_idx" ON "knowledge_documents" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "knowledge_documents_grade_subject_id_fk_idx" ON "knowledge_documents" ("grade_subject_id") WHERE "grade_subject_id" is not null;--> statement-breakpoint
CREATE INDEX "knowledge_documents_uploaded_by_fk_idx" ON "knowledge_documents" ("uploaded_by");--> statement-breakpoint
CREATE INDEX "risk_reviews_branch_id_fk_idx" ON "risk_reviews" ("branch_id");--> statement-breakpoint
CREATE INDEX "risk_reviews_student_id_fk_idx" ON "risk_reviews" ("student_id");--> statement-breakpoint
CREATE INDEX "risk_reviews_reviewed_by_fk_idx" ON "risk_reviews" ("reviewed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_scores_student_score_date_uq" ON "risk_scores" ("student_id","score_date") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "risk_scores_branch_score_date_band_idx" ON "risk_scores" ("org_id","branch_id","score_date","band");--> statement-breakpoint
CREATE INDEX "risk_scores_branch_id_fk_idx" ON "risk_scores" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_mastery_section_unit_student_uq" ON "topic_mastery" ("section_id","unit_id",coalesce("student_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "topic_mastery_branch_id_fk_idx" ON "topic_mastery" ("branch_id");--> statement-breakpoint
CREATE INDEX "topic_mastery_grade_subject_id_fk_idx" ON "topic_mastery" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "topic_mastery_unit_id_fk_idx" ON "topic_mastery" ("unit_id");--> statement-breakpoint
CREATE INDEX "topic_mastery_student_id_fk_idx" ON "topic_mastery" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "kpi_snapshots" ADD CONSTRAINT "kpi_snapshots_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "report_runs" ADD CONSTRAINT "report_runs_schedule_id_report_schedules_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "report_schedules"("id");--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_saved_report_id_saved_reports_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id");--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_run_as_user_id_profiles_id_fkey" FOREIGN KEY ("run_as_user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_alert_rules_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "alert_rules"("id");--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_profiles_id_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "branch_targets" ADD CONSTRAINT "branch_targets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "branch_targets" ADD CONSTRAINT "branch_targets_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "branch_targets" ADD CONSTRAINT "branch_targets_set_by_profiles_id_fkey" FOREIGN KEY ("set_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "executive_digests" ADD CONSTRAINT "executive_digests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hq_notes" ADD CONSTRAINT "hq_notes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hq_notes" ADD CONSTRAINT "hq_notes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hq_notes" ADD CONSTRAINT "hq_notes_author_id_profiles_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "activity_flags" ADD CONSTRAINT "activity_flags_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "activity_flags" ADD CONSTRAINT "activity_flags_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "activity_flags" ADD CONSTRAINT "activity_flags_reviewed_by_profiles_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_run_id_ai_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id");--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_output_id_ai_outputs_id_fkey" FOREIGN KEY ("output_id") REFERENCES "ai_outputs"("id");--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_message_id_ai_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id");--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_run_id_ai_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id");--> statement-breakpoint
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_run_id_ai_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_runs"("id");--> statement-breakpoint
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_conversation_id_ai_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id");--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ai_usage_daily" ADD CONSTRAINT "ai_usage_daily_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "defaulter_scores" ADD CONSTRAINT "defaulter_scores_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "defaulter_scores" ADD CONSTRAINT "defaulter_scores_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "defaulter_scores" ADD CONSTRAINT "defaulter_scores_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id");--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_uploaded_by_profiles_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "risk_reviews" ADD CONSTRAINT "risk_reviews_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "risk_reviews" ADD CONSTRAINT "risk_reviews_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "risk_reviews" ADD CONSTRAINT "risk_reviews_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "risk_reviews" ADD CONSTRAINT "risk_reviews_reviewed_by_profiles_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "topic_mastery" ADD CONSTRAINT "topic_mastery_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
CREATE POLICY "dashboard_layouts_staff_read" ON "dashboard_layouts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("dashboard_layouts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "dashboard_layouts_self" ON "dashboard_layouts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("dashboard_layouts"."org_id" = (select app.org_id()) and "dashboard_layouts"."user_id" = (select app.user_id())) WITH CHECK ("dashboard_layouts"."org_id" = (select app.org_id()) and "dashboard_layouts"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "kpi_snapshots_staff" ON "kpi_snapshots" AS PERMISSIVE FOR ALL TO "authenticated" USING ("kpi_snapshots"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("kpi_snapshots"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "report_runs_staff_read" ON "report_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("report_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "report_runs_staff_insert" ON "report_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("report_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "report_schedules_staff" ON "report_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("report_schedules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("report_schedules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "saved_reports_staff" ON "saved_reports" AS PERMISSIVE FOR ALL TO "authenticated" USING ("saved_reports"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("saved_reports"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "saved_reports_self" ON "saved_reports" AS PERMISSIVE FOR ALL TO "authenticated" USING ("saved_reports"."org_id" = (select app.org_id()) and "saved_reports"."user_id" = (select app.user_id())) WITH CHECK ("saved_reports"."org_id" = (select app.org_id()) and "saved_reports"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "alert_rules_staff" ON "alert_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("alert_rules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("alert_rules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "alerts_staff" ON "alerts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("alerts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("alerts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "branch_targets_staff" ON "branch_targets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("branch_targets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("branch_targets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "executive_digests_staff" ON "executive_digests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("executive_digests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("executive_digests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hq_notes_staff" ON "hq_notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hq_notes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hq_notes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "activity_flags_staff" ON "activity_flags" AS PERMISSIVE FOR ALL TO "authenticated" USING ("activity_flags"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("activity_flags"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ai_conversations_self_read" ON "ai_conversations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_conversations"."org_id" = (select app.org_id()) and "ai_conversations"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "ai_feedback_staff" ON "ai_feedback" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_feedback"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ai_feedback"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ai_messages_self_read" ON "ai_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_messages"."org_id" = (select app.org_id()) and "ai_messages"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "ai_outputs_staff" ON "ai_outputs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_outputs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ai_outputs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ai_runs_staff_read" ON "ai_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ai_runs_staff_insert" ON "ai_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("ai_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ai_settings_staff" ON "ai_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_settings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ai_settings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ai_usage_daily_staff" ON "ai_usage_daily" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_usage_daily"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ai_usage_daily"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "defaulter_scores_staff" ON "defaulter_scores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("defaulter_scores"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("defaulter_scores"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "defaulter_scores_branch" ON "defaulter_scores" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "defaulter_scores"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "defaulter_scores"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "knowledge_chunks_staff" ON "knowledge_chunks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("knowledge_chunks"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("knowledge_chunks"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "knowledge_documents_staff" ON "knowledge_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("knowledge_documents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("knowledge_documents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "risk_reviews_staff" ON "risk_reviews" AS PERMISSIVE FOR ALL TO "authenticated" USING ("risk_reviews"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("risk_reviews"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "risk_reviews_branch" ON "risk_reviews" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "risk_reviews"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "risk_reviews"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "risk_scores_staff" ON "risk_scores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("risk_scores"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("risk_scores"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "risk_scores_branch" ON "risk_scores" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "risk_scores"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "risk_scores"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "topic_mastery_staff" ON "topic_mastery" AS PERMISSIVE FOR ALL TO "authenticated" USING ("topic_mastery"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("topic_mastery"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "topic_mastery_branch" ON "topic_mastery" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "topic_mastery"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "topic_mastery"."branch_id" = any ((select app.branch_ids())::uuid[])));