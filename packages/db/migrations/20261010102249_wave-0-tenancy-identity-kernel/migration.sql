CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"name_ur" text,
	"slug" text NOT NULL,
	"legal_name" text,
	"logo_file_id" uuid,
	"ntn" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"city" text NOT NULL,
	"province" text NOT NULL,
	"academic_year_start_month" integer DEFAULT 4 NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 7 NOT NULL,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"billing_mode" text DEFAULT 'student' NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "orgs_province_chk" CHECK ("province" in ('punjab', 'sindh', 'kp', 'balochistan', 'ict', 'ajk', 'gb')),
	CONSTRAINT "orgs_default_locale_chk" CHECK ("default_locale" in ('en', 'ur')),
	CONSTRAINT "orgs_billing_mode_chk" CHECK ("billing_mode" in ('student', 'family')),
	CONSTRAINT "orgs_status_chk" CHECK ("status" in ('provisioning', 'active', 'suspended', 'closed')),
	CONSTRAINT "orgs_academic_year_start_month_range" CHECK ("academic_year_start_month" between 1 and 12),
	CONSTRAINT "orgs_fiscal_year_start_month_range" CHECK ("fiscal_year_start_month" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "orgs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"phone" text,
	"email" text,
	"gender" text DEFAULT 'mixed' NOT NULL,
	"principal_staff_id" uuid,
	"regulator_name" text,
	"regulator_registration_no" text,
	"regulator_expires_on" date,
	"board_id" uuid,
	"board_affiliation_no" text,
	"board_affiliation_expires_on" date,
	"capacity" integer,
	"opened_on" date,
	"latitude" numeric(9,6),
	"longitude" numeric(9,6),
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "branches_gender_chk" CHECK ("gender" in ('boys', 'girls', 'mixed')),
	CONSTRAINT "branches_status_chk" CHECK ("status" in ('active', 'inactive')),
	CONSTRAINT "branches_capacity_pos" CHECK ("capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "branch_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branch_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "onboarding_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	CONSTRAINT "onboarding_tasks_key_chk" CHECK ("key" in ('profile', 'academic_year', 'grades', 'sections', 'subjects', 'fee_structure', 'staff', 'students', 'first_voucher_run')),
	CONSTRAINT "onboarding_tasks_status_chk" CHECK ("status" in ('pending', 'done', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'classroom' NOT NULL,
	"capacity" integer,
	"floor" text,
	"is_bookable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "rooms_kind_chk" CHECK ("kind" in ('classroom', 'lab', 'library', 'hall', 'office', 'clinic', 'store', 'other')),
	CONSTRAINT "rooms_capacity_pos" CHECK ("capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"grade_from" integer NOT NULL,
	"grade_to" integer NOT NULL,
	"head_staff_id" uuid,
	CONSTRAINT "wings_grade_from_range" CHECK ("grade_from" between 1 and 10),
	CONSTRAINT "wings_grade_to_range" CHECK ("grade_to" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "wings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"actor_id" uuid,
	"actor_kind" text NOT NULL,
	"source" text NOT NULL,
	"request_id" text NOT NULL,
	"branch_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}' NOT NULL,
	"summary" text,
	"ip" text,
	"user_agent" text,
	"device_id" uuid,
	"support_session_id" uuid,
	CONSTRAINT "audit_log_actor_kind_chk" CHECK ("actor_kind" in ('staff', 'guardian', 'student', 'platform', 'system')),
	CONSTRAINT "audit_log_source_chk" CHECK ("source" in ('api', 'sync', 'job', 'ai'))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"person_id" uuid NOT NULL,
	"email" text,
	"phone" text,
	"token_hash" text NOT NULL,
	"role_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"branch_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"all_branches" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" uuid,
	CONSTRAINT "invitations_kind_chk" CHECK ("kind" in ('staff', 'guardian', 'student')),
	CONSTRAINT "invitations_status_chk" CHECK ("status" in ('pending', 'accepted', 'expired', 'revoked')),
	CONSTRAINT "invitations_contact_chk" CHECK ("email" is not null or "phone" is not null)
);
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"org_id" uuid,
	"event" text NOT NULL,
	"identifier_hash" text,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "login_events_event_chk" CHECK ("event" in ('sign_in', 'sign_out', 'failed', 'locked', 'otp_sent', 'mfa_passed', 'mfa_failed', 'password_reset', 'invitation_accepted'))
);
--> statement-breakpoint
ALTER TABLE "login_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"membership_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"staff_id" uuid,
	"guardian_id" uuid,
	"student_id" uuid,
	"status" text NOT NULL,
	"all_branches" boolean DEFAULT false NOT NULL,
	"suspended_reason" text,
	"token_version" integer DEFAULT 1 NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "memberships_kind_chk" CHECK ("kind" in ('staff', 'guardian', 'student')),
	CONSTRAINT "memberships_status_chk" CHECK ("status" in ('invited', 'active', 'suspended')),
	CONSTRAINT "memberships_person_chk" CHECK (("kind" = 'staff' and "staff_id" is not null and "guardian_id" is null and "student_id" is null)
       or ("kind" = 'guardian' and "guardian_id" is not null and "staff_id" is null and "student_id" is null)
       or ("kind" = 'student' and "student_id" is not null and "staff_id" is null and "guardian_id" is null))
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"module_key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"avatar_file_id" uuid,
	"last_seen_at" timestamp with time zone,
	"is_platform" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"description" text,
	"level" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"default_all_branches" boolean DEFAULT false NOT NULL,
	CONSTRAINT "roles_level_chk" CHECK ("level" in ('group', 'branch', 'academics', 'finance', 'hr', 'front', 'operations', 'family'))
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text,
	"platform" text NOT NULL,
	"push_token" text,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_devices_platform_chk" CHECK ("platform" in ('web', 'android', 'ios'))
);
--> statement-breakpoint
ALTER TABLE "user_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"density" text DEFAULT 'normal' NOT NULL,
	"number_style" text DEFAULT 'international' NOT NULL,
	"default_org_id" uuid,
	"default_branch_id" uuid,
	CONSTRAINT "user_preferences_locale_chk" CHECK ("locale" in ('en', 'ur')),
	CONSTRAINT "user_preferences_theme_chk" CHECK ("theme" in ('system', 'light', 'dark')),
	CONSTRAINT "user_preferences_density_chk" CHECK ("density" in ('compact', 'normal', 'comfortable')),
	CONSTRAINT "user_preferences_number_style_chk" CHECK ("number_style" in ('international', 'south_asian'))
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"label" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"purpose" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"checksum" text,
	"width" integer,
	"height" integer,
	"thumbnail_path" text,
	"uploaded_by" uuid NOT NULL,
	CONSTRAINT "files_purpose_chk" CHECK ("purpose" in ('photo', 'document', 'learning', 'import', 'export', 'generated', 'knowledge', 'site', 'payment_proof')),
	CONSTRAINT "files_status_chk" CHECK ("status" in ('pending', 'ready', 'quarantined', 'deleted')),
	CONSTRAINT "files_size_bytes_pos" CHECK ("size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"number" text,
	"language" text NOT NULL,
	"content_hash" text NOT NULL,
	"verify_token_hash" text,
	"batch_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "generated_documents_language_chk" CHECK ("language" in ('en', 'ur', 'both'))
);
--> statement-breakpoint
ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"request_id" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "domain_events_source_chk" CHECK ("source" in ('api', 'sync', 'job', 'ai'))
);
--> statement-breakpoint
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"cron" text NOT NULL,
	"job_name" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"fan_out" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_enqueued_for" timestamp with time zone,
	CONSTRAINT "job_schedules_fan_out_chk" CHECK ("fan_out" in ('platform', 'per_org', 'per_branch'))
);
--> statement-breakpoint
ALTER TABLE "job_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"timeout_seconds" integer DEFAULT 120 NOT NULL,
	"concurrency_key" text,
	"dedupe_key" text,
	"locked_by" text,
	"locked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_error" text,
	"parent_job_id" uuid,
	"progress" jsonb,
	CONSTRAINT "jobs_status_chk" CHECK ("status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "number_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"branch_id" uuid,
	"period" text DEFAULT '' NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "number_sequences_uq" UNIQUE NULLS NOT DISTINCT("org_id","key","branch_id","period"),
	CONSTRAINT "number_sequences_next_value_pos" CHECK ("next_value" > 0)
);
--> statement-breakpoint
ALTER TABLE "number_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entity_type" text NOT NULL,
	"name" text NOT NULL,
	"min_amount" bigint,
	"steps" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "approval_policies_min_amount_min" CHECK ("min_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "approval_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"branch_id" uuid,
	"policy_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"amount" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"requested_by" uuid NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "approval_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "approval_requests_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "approval_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"request_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"status" text NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "approval_steps_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'skipped')),
	CONSTRAINT "approval_steps_reject_note_chk" CHECK ("status" <> 'rejected' or "note" is not null)
);
--> statement-breakpoint
ALTER TABLE "approval_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_field_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entity" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"label_ur" text,
	"field_type" text NOT NULL,
	"options" jsonb,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "custom_field_defs_entity_chk" CHECK ("entity" in ('student', 'guardian', 'staff', 'admission')),
	CONSTRAINT "custom_field_defs_field_type_chk" CHECK ("field_type" in ('text', 'number', 'date', 'select', 'bool')),
	CONSTRAINT "custom_field_defs_key_chk" CHECK ("key" ~ '^[a-z][a-z0-9_]*$')
);
--> statement-breakpoint
ALTER TABLE "custom_field_defs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"filters" jsonb NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"file_id" uuid,
	"row_count" integer,
	"includes_sensitive" boolean DEFAULT false NOT NULL,
	CONSTRAINT "export_jobs_format_chk" CHECK ("format" in ('csv', 'xlsx', 'pdf')),
	CONSTRAINT "export_jobs_status_chk" CHECK ("status" in ('queued', 'running', 'ready', 'failed', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "export_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"branch_id" uuid,
	"status" text NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"created_rows" integer DEFAULT 0 NOT NULL,
	"options" jsonb DEFAULT '{}' NOT NULL,
	"error_file_id" uuid,
	"started_by" uuid NOT NULL,
	CONSTRAINT "import_batches_status_chk" CHECK ("status" in ('uploaded', 'validating', 'ready', 'committing', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"parsed" jsonb,
	"status" text NOT NULL,
	"errors" jsonb,
	"entity_id" uuid,
	CONSTRAINT "import_rows_status_chk" CHECK ("status" in ('valid', 'invalid', 'created', 'skipped', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integrity_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"check_name" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"detail" jsonb NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_note" text,
	CONSTRAINT "integrity_findings_severity_chk" CHECK ("severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "integrity_findings_status_chk" CHECK ("status" in ('open', 'acknowledged', 'resolved'))
);
--> statement-breakpoint
ALTER TABLE "integrity_findings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'staff' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notes_visibility_chk" CHECK ("visibility" in ('staff', 'leaders')),
	CONSTRAINT "notes_body_len_chk" CHECK (char_length("body") between 1 and 5000)
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"list_key" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"device_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"device_value" jsonb NOT NULL,
	"server_value" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "sync_conflicts_status_chk" CHECK ("status" in ('open', 'kept_server', 'took_device', 'merged'))
);
--> statement-breakpoint
ALTER TABLE "sync_conflicts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"device_code" text NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"app_version" text NOT NULL,
	"last_sync_at" timestamp with time zone,
	"pending_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revoked_by" uuid,
	CONSTRAINT "sync_devices_platform_chk" CHECK ("platform" in ('web', 'android', 'ios')),
	CONSTRAINT "sync_devices_status_chk" CHECK ("status" in ('active', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "sync_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_ops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"device_id" uuid NOT NULL,
	"op_id" text NOT NULL,
	"table_name" text NOT NULL,
	"result" text NOT NULL,
	CONSTRAINT "sync_ops_result_chk" CHECK ("result" in ('applied', 'rejected', 'conflict', 'duplicate'))
);
--> statement-breakpoint
ALTER TABLE "sync_ops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"op_id" text NOT NULL,
	"table_name" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"reason_code" text NOT NULL,
	"reason" text NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sync_rejections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "demo_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"school_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"city" text,
	"student_band" text,
	"message" text,
	"source" text,
	"status" text DEFAULT 'new' NOT NULL,
	"assigned_to" uuid,
	"notes" text,
	CONSTRAINT "demo_requests_student_band_chk" CHECK ("student_band" in ('under_200', '200_500', '500_1000', '1000_3000', 'over_3000')),
	CONSTRAINT "demo_requests_status_chk" CHECK ("status" in ('new', 'contacted', 'demo_booked', 'won', 'lost'))
);
--> statement-breakpoint
ALTER TABLE "demo_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"default_enabled" boolean DEFAULT false NOT NULL,
	"enabled_org_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"disabled_org_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "org_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"module_key" text NOT NULL,
	"is_enabled" boolean NOT NULL,
	"source" text NOT NULL,
	"note" text,
	CONSTRAINT "org_modules_source_chk" CHECK ("source" in ('plan', 'override'))
);
--> statement-breakpoint
ALTER TABLE "org_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan_id" uuid NOT NULL,
	"module_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_per_student" bigint NOT NULL,
	"minimum_monthly" bigint DEFAULT 0 NOT NULL,
	"max_students" integer,
	"max_branches" integer,
	"trial_days" integer DEFAULT 14 NOT NULL,
	"ai_monthly_budget" bigint DEFAULT 0 NOT NULL,
	"sms_included" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plans_price_per_student_min" CHECK ("price_per_student" >= 0),
	CONSTRAINT "plans_minimum_monthly_min" CHECK ("minimum_monthly" >= 0),
	CONSTRAINT "plans_ai_monthly_budget_min" CHECK ("ai_monthly_budget" >= 0),
	CONSTRAINT "plans_trial_days_min" CHECK ("trial_days" >= 0)
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"mfa_enrolled_at" timestamp with time zone,
	CONSTRAINT "platform_admins_role_chk" CHECK ("role" in ('super_admin', 'support_agent'))
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" text DEFAULT 'staff' NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	CONSTRAINT "platform_announcements_audience_chk" CHECK ("audience" in ('everyone', 'owners', 'staff')),
	CONSTRAINT "platform_announcements_severity_chk" CHECK ("severity" in ('info', 'warning', 'critical')),
	CONSTRAINT "platform_announcements_period_chk" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
ALTER TABLE "platform_announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_org_id" uuid,
	"entity_type" text,
	"entity_id" uuid,
	"detail" jsonb DEFAULT '{}' NOT NULL,
	"ip" text,
	"request_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"number" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"student_count" integer NOT NULL,
	"amount" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"status" text NOT NULL,
	"issued_on" date,
	"due_on" date,
	"paid_on" date,
	"payment_method" text,
	"payment_reference" text,
	"file_id" uuid,
	CONSTRAINT "subscription_invoices_status_chk" CHECK ("status" in ('draft', 'issued', 'paid', 'overdue', 'void')),
	CONSTRAINT "subscription_invoices_payment_method_chk" CHECK ("payment_method" in ('bank_transfer', 'cheque', 'cash', 'online')),
	CONSTRAINT "subscription_invoices_student_count_min" CHECK ("student_count" >= 0),
	CONSTRAINT "subscription_invoices_amount_min" CHECK ("amount" >= 0),
	CONSTRAINT "subscription_invoices_discount_min" CHECK ("discount" >= 0),
	CONSTRAINT "subscription_invoices_tax_min" CHECK ("tax" >= 0),
	CONSTRAINT "subscription_invoices_total_chk" CHECK ("total" = "amount" - "discount" + "tax")
);
--> statement-breakpoint
ALTER TABLE "subscription_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"price_per_student" bigint NOT NULL,
	"discount_percent" numeric(5,2) DEFAULT '0' NOT NULL,
	"started_on" date NOT NULL,
	"trial_ends_on" date,
	"current_period_start" date NOT NULL,
	"current_period_end" date NOT NULL,
	"grace_days" integer DEFAULT 10 NOT NULL,
	"cancelled_on" date,
	"notes" text,
	CONSTRAINT "subscriptions_status_chk" CHECK ("status" in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
	CONSTRAINT "subscriptions_billing_cycle_chk" CHECK ("billing_cycle" in ('monthly', 'yearly')),
	CONSTRAINT "subscriptions_price_per_student_min" CHECK ("price_per_student" >= 0),
	CONSTRAINT "subscriptions_discount_range" CHECK ("discount_percent" between 0 and 100),
	CONSTRAINT "subscriptions_period_chk" CHECK ("current_period_end" >= "current_period_start")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "support_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"org_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"access" text DEFAULT 'read' NOT NULL,
	"status" text NOT NULL,
	"approved_by" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	CONSTRAINT "support_sessions_access_chk" CHECK ("access" in ('read', 'write')),
	CONSTRAINT "support_sessions_status_chk" CHECK ("status" in ('requested', 'active', 'ended', 'expired', 'denied')),
	CONSTRAINT "support_sessions_reason_chk" CHECK (char_length("reason") >= 10),
	CONSTRAINT "support_sessions_length_chk" CHECK ("ends_at" is null or "starts_at" is null or "ends_at" <= "starts_at" + interval '60 minutes')
);
--> statement-breakpoint
ALTER TABLE "support_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"active_students" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"sms_sent" integer DEFAULT 0 NOT NULL,
	"whatsapp_sent" integer DEFAULT 0 NOT NULL,
	"storage_bytes" bigint DEFAULT 0 NOT NULL,
	"ai_cost" bigint DEFAULT 0 NOT NULL,
	"api_requests" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_slug_uq" ON "orgs" ("slug") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "orgs_logo_file_id_fk_idx" ON "orgs" ("logo_file_id") WHERE "logo_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "branches_code_uq" ON "branches" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "branches_org_status_idx" ON "branches" ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "branch_settings_key_uq" ON "branch_settings" ("branch_id","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_tasks_key_uq" ON "onboarding_tasks" ("org_id","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "onboarding_tasks_completed_by_fk_idx" ON "onboarding_tasks" ("completed_by") WHERE "completed_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "org_settings_key_uq" ON "org_settings" ("org_id","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_name_uq" ON "rooms" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "rooms_branch_idx" ON "rooms" ("org_id","branch_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "wings_name_uq" ON "wings" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "wings_branch_idx" ON "wings" ("org_id","branch_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" ("org_id","entity","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" ("org_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_time_idx" ON "audit_log" ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_device_id_fk_idx" ON "audit_log" ("device_id") WHERE "device_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_log_support_session_id_fk_idx" ON "audit_log" ("support_session_id") WHERE "support_session_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_uq" ON "invitations" ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_uq" ON "invitations" ("org_id","kind","person_id") WHERE "status" = 'pending' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "invitations_org_status_idx" ON "invitations" ("org_id","status");--> statement-breakpoint
CREATE INDEX "invitations_accepted_user_id_fk_idx" ON "invitations" ("accepted_user_id") WHERE "accepted_user_id" is not null;--> statement-breakpoint
CREATE INDEX "login_events_user_idx" ON "login_events" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_org_idx" ON "login_events" ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "login_events_identifier_idx" ON "login_events" ("identifier_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_branches_uq" ON "membership_branches" ("membership_id","branch_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "membership_branches_branch_idx" ON "membership_branches" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_roles_uq" ON "membership_roles" ("membership_id","role_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "membership_roles_role_idx" ON "membership_roles" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_kind_uq" ON "memberships" ("org_id","user_id","kind") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_staff_uq" ON "memberships" ("org_id","staff_id") WHERE "deleted_at" is null and "staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_guardian_uq" ON "memberships" ("org_id","guardian_id") WHERE "deleted_at" is null and "guardian_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_student_uq" ON "memberships" ("org_id","student_id") WHERE "deleted_at" is null and "student_id" is not null;--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" ("user_id");--> statement-breakpoint
CREATE INDEX "permissions_module_idx" ON "permissions" ("module_key");--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" ("email");--> statement-breakpoint
CREATE INDEX "profiles_phone_idx" ON "profiles" ("phone");--> statement-breakpoint
CREATE INDEX "profiles_avatar_file_id_fk_idx" ON "profiles" ("avatar_file_id") WHERE "avatar_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_uq" ON "role_permissions" ("role_id","permission_key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "role_permissions_org_idx" ON "role_permissions" ("org_id","role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_permission_key_fk_idx" ON "role_permissions" ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_uq" ON "roles" ("org_id","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_uq" ON "user_devices" ("user_id","fingerprint") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_uq" ON "user_preferences" ("user_id");--> statement-breakpoint
CREATE INDEX "user_preferences_default_org_id_fk_idx" ON "user_preferences" ("default_org_id") WHERE "default_org_id" is not null;--> statement-breakpoint
CREATE INDEX "user_preferences_default_branch_id_fk_idx" ON "user_preferences" ("default_branch_id") WHERE "default_branch_id" is not null;--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" ("org_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachments_file_idx" ON "attachments" ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_path_uq" ON "files" ("path");--> statement-breakpoint
CREATE INDEX "files_org_status_idx" ON "files" ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX "files_uploaded_by_fk_idx" ON "files" ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_documents_number_uq" ON "generated_documents" ("org_id","kind","number") WHERE "number" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "generated_documents_verify_uq" ON "generated_documents" ("verify_token_hash") WHERE "verify_token_hash" is not null;--> statement-breakpoint
CREATE INDEX "generated_documents_entity_idx" ON "generated_documents" ("org_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "generated_documents_file_idx" ON "generated_documents" ("file_id");--> statement-breakpoint
CREATE INDEX "domain_events_name_idx" ON "domain_events" ("org_id","name","created_at");--> statement-breakpoint
CREATE INDEX "domain_events_entity_idx" ON "domain_events" ("org_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_uq" ON "idempotency_keys" ("org_id","user_id","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expiry_idx" ON "idempotency_keys" ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_user_id_fk_idx" ON "idempotency_keys" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_schedules_name_uq" ON "job_schedules" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_uq" ON "jobs" ("dedupe_key") WHERE "dedupe_key" is not null and "status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" ("status","run_at","priority");--> statement-breakpoint
CREATE INDEX "jobs_org_name_idx" ON "jobs" ("org_id","name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_concurrency_uq" ON "jobs" ("concurrency_key") WHERE "concurrency_key" is not null and "status" = 'running';--> statement-breakpoint
CREATE INDEX "jobs_parent_job_id_fk_idx" ON "jobs" ("parent_job_id") WHERE "parent_job_id" is not null;--> statement-breakpoint
CREATE INDEX "number_sequences_branch_id_fk_idx" ON "number_sequences" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_uq" ON "rate_limits" ("key","window_start");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" ("window_start");--> statement-breakpoint
CREATE INDEX "approval_policies_entity_idx" ON "approval_policies" ("org_id","entity_type","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_pending_uq" ON "approval_requests" ("org_id","entity_type","entity_id") WHERE "status" = 'pending' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX "approval_requests_requester_idx" ON "approval_requests" ("org_id","requested_by");--> statement-breakpoint
CREATE INDEX "approval_requests_policy_idx" ON "approval_requests" ("policy_id");--> statement-breakpoint
CREATE INDEX "approval_requests_branch_id_fk_idx" ON "approval_requests" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "approval_requests_requested_by_fk_idx" ON "approval_requests" ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_steps_uq" ON "approval_steps" ("request_id","step_order") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "approval_steps_decided_by_fk_idx" ON "approval_steps" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_defs_uq" ON "custom_field_defs" ("org_id","entity","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "export_jobs_user_idx" ON "export_jobs" ("org_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "export_jobs_user_id_fk_idx" ON "export_jobs" ("user_id");--> statement-breakpoint
CREATE INDEX "export_jobs_file_id_fk_idx" ON "export_jobs" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "import_batches_idx" ON "import_batches" ("org_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "import_batches_file_idx" ON "import_batches" ("file_id");--> statement-breakpoint
CREATE INDEX "import_batches_branch_id_fk_idx" ON "import_batches" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "import_batches_error_file_id_fk_idx" ON "import_batches" ("error_file_id") WHERE "error_file_id" is not null;--> statement-breakpoint
CREATE INDEX "import_batches_started_by_fk_idx" ON "import_batches" ("started_by");--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "import_rows" ("batch_id","status","row_number");--> statement-breakpoint
CREATE INDEX "integrity_findings_idx" ON "integrity_findings" ("org_id","status","severity","created_at");--> statement-breakpoint
CREATE INDEX "integrity_findings_resolved_by_fk_idx" ON "integrity_findings" ("resolved_by") WHERE "resolved_by" is not null;--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" ("org_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_views_user_idx" ON "saved_views" ("org_id","user_id","list_key");--> statement-breakpoint
CREATE INDEX "saved_views_user_id_fk_idx" ON "saved_views" ("user_id");--> statement-breakpoint
CREATE INDEX "sync_conflicts_idx" ON "sync_conflicts" ("org_id","status","created_at");--> statement-breakpoint
CREATE INDEX "sync_conflicts_device_idx" ON "sync_conflicts" ("device_id");--> statement-breakpoint
CREATE INDEX "sync_conflicts_resolved_by_fk_idx" ON "sync_conflicts" ("resolved_by") WHERE "resolved_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_devices_code_uq" ON "sync_devices" ("org_id","device_code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sync_devices_user_idx" ON "sync_devices" ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "sync_devices_user_id_fk_idx" ON "sync_devices" ("user_id");--> statement-breakpoint
CREATE INDEX "sync_devices_revoked_by_fk_idx" ON "sync_devices" ("revoked_by") WHERE "revoked_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_ops_uq" ON "sync_ops" ("org_id","device_id","op_id");--> statement-breakpoint
CREATE INDEX "sync_ops_device_id_fk_idx" ON "sync_ops" ("device_id");--> statement-breakpoint
CREATE INDEX "sync_rejections_user_idx" ON "sync_rejections" ("org_id","user_id","resolved_at");--> statement-breakpoint
CREATE INDEX "sync_rejections_device_idx" ON "sync_rejections" ("device_id");--> statement-breakpoint
CREATE INDEX "sync_rejections_user_id_fk_idx" ON "sync_rejections" ("user_id");--> statement-breakpoint
CREATE INDEX "demo_requests_status_idx" ON "demo_requests" ("status","created_at");--> statement-breakpoint
CREATE INDEX "demo_requests_assigned_to_fk_idx" ON "demo_requests" ("assigned_to") WHERE "assigned_to" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_key_uq" ON "feature_flags" ("key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "org_modules_uq" ON "org_modules" ("org_id","module_key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_modules_uq" ON "plan_modules" ("plan_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_key_uq" ON "plans" ("key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_user_uq" ON "platform_admins" ("user_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "platform_announcements_time_idx" ON "platform_announcements" ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "platform_audit_log_admin_idx" ON "platform_audit_log" ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_audit_log_org_idx" ON "platform_audit_log" ("target_org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_settings_key_uq" ON "platform_settings" ("key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoices_number_uq" ON "subscription_invoices" ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_invoices_period_uq" ON "subscription_invoices" ("subscription_id","period_start") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "subscription_invoices_org_idx" ON "subscription_invoices" ("org_id","status");--> statement-breakpoint
CREATE INDEX "subscription_invoices_file_id_fk_idx" ON "subscription_invoices" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_org_uq" ON "subscriptions" ("org_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions" ("plan_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" ("status","current_period_end");--> statement-breakpoint
CREATE INDEX "support_sessions_org_idx" ON "support_sessions" ("org_id","status");--> statement-breakpoint
CREATE INDEX "support_sessions_admin_idx" ON "support_sessions" ("admin_user_id","status");--> statement-breakpoint
CREATE INDEX "support_sessions_approved_by_fk_idx" ON "support_sessions" ("approved_by") WHERE "approved_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_daily_uq" ON "usage_daily" ("org_id","usage_date");--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_logo_file_id_files_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "branch_settings" ADD CONSTRAINT "branch_settings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "branch_settings" ADD CONSTRAINT "branch_settings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_completed_by_profiles_id_fkey" FOREIGN KEY ("completed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "wings" ADD CONSTRAINT "wings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "wings" ADD CONSTRAINT "wings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_profiles_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_device_id_sync_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_devices"("id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_support_session_id_support_sessions_id_fkey" FOREIGN KEY ("support_session_id") REFERENCES "support_sessions"("id");--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_user_id_profiles_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "membership_branches" ADD CONSTRAINT "membership_branches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "membership_branches" ADD CONSTRAINT "membership_branches_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "membership_branches" ADD CONSTRAINT "membership_branches_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_file_id_files_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_org_id_orgs_id_fkey" FOREIGN KEY ("default_org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_default_branch_id_branches_id_fkey" FOREIGN KEY ("default_branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_profiles_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_parent_job_id_jobs_id_fkey" FOREIGN KEY ("parent_job_id") REFERENCES "jobs"("id");--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_policy_id_approval_policies_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id");--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_request_id_approval_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "custom_field_defs" ADD CONSTRAINT "custom_field_defs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_error_file_id_files_id_fkey" FOREIGN KEY ("error_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_started_by_profiles_id_fkey" FOREIGN KEY ("started_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id");--> statement-breakpoint
ALTER TABLE "integrity_findings" ADD CONSTRAINT "integrity_findings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "integrity_findings" ADD CONSTRAINT "integrity_findings_resolved_by_profiles_id_fkey" FOREIGN KEY ("resolved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_device_id_sync_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_devices"("id");--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolved_by_profiles_id_fkey" FOREIGN KEY ("resolved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "sync_devices" ADD CONSTRAINT "sync_devices_revoked_by_profiles_id_fkey" FOREIGN KEY ("revoked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "sync_ops" ADD CONSTRAINT "sync_ops_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "sync_ops" ADD CONSTRAINT "sync_ops_device_id_sync_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_devices"("id");--> statement-breakpoint
ALTER TABLE "sync_rejections" ADD CONSTRAINT "sync_rejections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "sync_rejections" ADD CONSTRAINT "sync_rejections_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "sync_rejections" ADD CONSTRAINT "sync_rejections_device_id_sync_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_devices"("id");--> statement-breakpoint
ALTER TABLE "demo_requests" ADD CONSTRAINT "demo_requests_assigned_to_profiles_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "org_modules" ADD CONSTRAINT "org_modules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id");--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_admin_user_id_profiles_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_target_org_id_orgs_id_fkey" FOREIGN KEY ("target_org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id");--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id");--> statement-breakpoint
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_admin_user_id_profiles_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_approved_by_profiles_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
CREATE POLICY "orgs_member_read" ON "orgs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("orgs"."id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "orgs_staff_update" ON "orgs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("orgs"."id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("orgs"."id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "branches_staff" ON "branches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("branches"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("branches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "branches_member_read" ON "branches" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("branches"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "branch_settings_staff" ON "branch_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("branch_settings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("branch_settings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "branch_settings_branch" ON "branch_settings" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "branch_settings"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "branch_settings"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "branch_settings_member_read" ON "branch_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("branch_settings"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "onboarding_tasks_staff" ON "onboarding_tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("onboarding_tasks"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("onboarding_tasks"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "org_settings_staff" ON "org_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("org_settings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("org_settings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "org_settings_member_read" ON "org_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("org_settings"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "rooms_staff" ON "rooms" AS PERMISSIVE FOR ALL TO "authenticated" USING ("rooms"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("rooms"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "rooms_branch" ON "rooms" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "rooms"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "rooms"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "wings_staff" ON "wings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("wings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("wings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "wings_branch" ON "wings" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "wings"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "wings"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "audit_log_insert" ON "audit_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("audit_log"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "audit_log_read" ON "audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("audit_log"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "invitations_staff" ON "invitations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("invitations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("invitations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "login_events_platform" ON "login_events" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "login_events_self_read" ON "login_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("login_events"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "membership_branches_staff" ON "membership_branches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("membership_branches"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("membership_branches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "membership_roles_staff" ON "membership_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("membership_roles"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("membership_roles"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "memberships_staff" ON "memberships" AS PERMISSIVE FOR ALL TO "authenticated" USING ("memberships"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("memberships"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "memberships_self_read" ON "memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("memberships"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "permissions_read" ON "permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "profiles_platform" ON "profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "profiles_self_read" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "profiles_self_update" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select app.user_id())) WITH CHECK ("profiles"."id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "profiles_org_read" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select app.is_staff()) and exists (
        select 1 from memberships m
        where m.user_id = "profiles"."id" and m.org_id = (select app.org_id()) and m.deleted_at is null
      ));--> statement-breakpoint
CREATE POLICY "role_permissions_staff" ON "role_permissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("role_permissions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("role_permissions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "roles_staff" ON "roles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("roles"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("roles"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "user_devices_platform" ON "user_devices" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "user_devices_self" ON "user_devices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_devices"."user_id" = (select app.user_id())) WITH CHECK ("user_devices"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "user_preferences_platform" ON "user_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "user_preferences_self" ON "user_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_preferences"."user_id" = (select app.user_id())) WITH CHECK ("user_preferences"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "attachments_staff" ON "attachments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("attachments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("attachments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "files_staff" ON "files" AS PERMISSIVE FOR ALL TO "authenticated" USING ("files"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("files"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "files_own_insert" ON "files" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("files"."org_id" = (select app.org_id()) and "files"."uploaded_by" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "files_own_read" ON "files" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("files"."org_id" = (select app.org_id()) and "files"."uploaded_by" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "files_own_update" ON "files" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("files"."org_id" = (select app.org_id()) and "files"."uploaded_by" = (select app.user_id()) and "files"."status" = 'pending') WITH CHECK ("files"."org_id" = (select app.org_id()) and "files"."uploaded_by" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "generated_documents_staff" ON "generated_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("generated_documents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("generated_documents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "domain_events_insert" ON "domain_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("domain_events"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "domain_events_read" ON "domain_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("domain_events"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "idempotency_keys_self" ON "idempotency_keys" AS PERMISSIVE FOR ALL TO "authenticated" USING ("idempotency_keys"."org_id" = (select app.org_id()) and "idempotency_keys"."user_id" = (select app.user_id())) WITH CHECK ("idempotency_keys"."org_id" = (select app.org_id()) and "idempotency_keys"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "job_schedules_platform" ON "job_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "jobs_insert" ON "jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("jobs"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "jobs_read" ON "jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("jobs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "number_sequences_member" ON "number_sequences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("number_sequences"."org_id" = (select app.org_id())) WITH CHECK ("number_sequences"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "rate_limits_platform" ON "rate_limits" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "approval_policies_staff" ON "approval_policies" AS PERMISSIVE FOR ALL TO "authenticated" USING ("approval_policies"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("approval_policies"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "approval_requests_staff" ON "approval_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("approval_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("approval_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "approval_steps_staff" ON "approval_steps" AS PERMISSIVE FOR ALL TO "authenticated" USING ("approval_steps"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("approval_steps"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "custom_field_defs_staff" ON "custom_field_defs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("custom_field_defs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("custom_field_defs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "export_jobs_staff" ON "export_jobs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("export_jobs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("export_jobs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "export_jobs_self" ON "export_jobs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("export_jobs"."org_id" = (select app.org_id()) and "export_jobs"."user_id" = (select app.user_id())) WITH CHECK ("export_jobs"."org_id" = (select app.org_id()) and "export_jobs"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "import_batches_staff" ON "import_batches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("import_batches"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("import_batches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "import_rows_staff" ON "import_rows" AS PERMISSIVE FOR ALL TO "authenticated" USING ("import_rows"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("import_rows"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "integrity_findings_staff" ON "integrity_findings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("integrity_findings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("integrity_findings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notes_staff" ON "notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("notes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "saved_views_staff" ON "saved_views" AS PERMISSIVE FOR ALL TO "authenticated" USING ("saved_views"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("saved_views"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "saved_views_self" ON "saved_views" AS PERMISSIVE FOR ALL TO "authenticated" USING ("saved_views"."org_id" = (select app.org_id()) and "saved_views"."user_id" = (select app.user_id())) WITH CHECK ("saved_views"."org_id" = (select app.org_id()) and "saved_views"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "sync_conflicts_staff" ON "sync_conflicts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sync_conflicts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("sync_conflicts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "sync_devices_staff" ON "sync_devices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sync_devices"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("sync_devices"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "sync_devices_self" ON "sync_devices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sync_devices"."org_id" = (select app.org_id()) and "sync_devices"."user_id" = (select app.user_id())) WITH CHECK ("sync_devices"."org_id" = (select app.org_id()) and "sync_devices"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "sync_ops_insert" ON "sync_ops" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("sync_ops"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "sync_ops_read" ON "sync_ops" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("sync_ops"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "sync_rejections_staff" ON "sync_rejections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sync_rejections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("sync_rejections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "sync_rejections_self" ON "sync_rejections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sync_rejections"."org_id" = (select app.org_id()) and "sync_rejections"."user_id" = (select app.user_id())) WITH CHECK ("sync_rejections"."org_id" = (select app.org_id()) and "sync_rejections"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "demo_requests_platform" ON "demo_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "feature_flags_platform" ON "feature_flags" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "org_modules_member_read" ON "org_modules" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("org_modules"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "plan_modules_read" ON "plan_modules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "plans_read" ON "plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "platform_admins_platform" ON "platform_admins" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "platform_announcements_read" ON "platform_announcements" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "platform_audit_log_platform" ON "platform_audit_log" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "platform_settings_platform" ON "platform_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "subscription_invoices_platform" ON "subscription_invoices" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "subscriptions_platform" ON "subscriptions" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "support_sessions_platform" ON "support_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "usage_daily_platform" ON "usage_daily" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);