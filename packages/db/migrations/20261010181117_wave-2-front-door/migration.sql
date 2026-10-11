CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"permission_keys" text[] NOT NULL,
	"branch_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "biometric_devices" (
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
	"serial_no" text NOT NULL,
	"model" text,
	"location" text,
	"used_for" text DEFAULT 'staff' NOT NULL,
	"direction" text DEFAULT 'both' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "biometric_devices_used_for_chk" CHECK ("used_for" in ('staff', 'students', 'both')),
	CONSTRAINT "biometric_devices_direction_chk" CHECK ("direction" in ('in', 'out', 'both')),
	CONSTRAINT "biometric_devices_status_chk" CHECK ("status" in ('active', 'inactive'))
);
--> statement-breakpoint
ALTER TABLE "biometric_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "biometric_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"person_kind" text NOT NULL,
	"staff_id" uuid,
	"student_id" uuid,
	"device_user_code" text NOT NULL,
	CONSTRAINT "biometric_enrolments_person_kind_chk" CHECK ("person_kind" in ('staff', 'student')),
	CONSTRAINT "biometric_enrolments_person" CHECK (("person_kind" = 'staff' and "staff_id" is not null and "student_id" is null) or ("person_kind" = 'student' and "student_id" is not null and "staff_id" is null))
);
--> statement-breakpoint
ALTER TABLE "biometric_enrolments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "biometric_punches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"device_user_code" text NOT NULL,
	"punched_at" timestamp with time zone NOT NULL,
	"direction" text DEFAULT 'unknown' NOT NULL,
	"person_kind" text,
	"staff_id" uuid,
	"student_id" uuid,
	"is_processed" boolean DEFAULT false NOT NULL,
	"raw" jsonb NOT NULL,
	CONSTRAINT "biometric_punches_direction_chk" CHECK ("direction" in ('in', 'out', 'unknown')),
	CONSTRAINT "biometric_punches_person_kind_chk" CHECK ("person_kind" in ('staff', 'student'))
);
--> statement-breakpoint
ALTER TABLE "biometric_punches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"category" text NOT NULL,
	"provider" text NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"mode" text DEFAULT 'test' NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"secrets_encrypted" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "integration_connections_category_chk" CHECK ("category" in ('payment', 'sms', 'whatsapp', 'email', 'push', 'biometric', 'gps', 'ai')),
	CONSTRAINT "integration_connections_mode_chk" CHECK ("mode" in ('test', 'live')),
	CONSTRAINT "integration_connections_status_chk" CHECK ("status" in ('disconnected', 'connected', 'error'))
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"endpoint_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"response_status" integer,
	"response_ms" integer,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "webhook_deliveries_status_chk" CHECK ("status" in ('pending', 'delivered', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"url" text NOT NULL,
	"description" text,
	"event_names" text[] NOT NULL,
	"secret_encrypted" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"disabled_reason" text,
	CONSTRAINT "webhook_endpoints_url_https" CHECK ("url" like 'https://%'),
	CONSTRAINT "webhook_endpoints_event_names_some" CHECK (cardinality("event_names") >= 1)
);
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"org_id" uuid,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"signature_ok" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"headers" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_status_chk" CHECK ("status" in ('received', 'processed', 'ignored', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admission_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"application_no" text NOT NULL,
	"enquiry_id" uuid,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"full_name" text NOT NULL,
	"full_name_ur" text,
	"father_name" text NOT NULL,
	"gender" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"b_form_no" text,
	"religion" text DEFAULT 'islam' NOT NULL,
	"previous_school" text,
	"previous_class" text,
	"previous_result_percent" numeric(5,2),
	"guardians" jsonb NOT NULL,
	"address" text NOT NULL,
	"city" text,
	"family_id" uuid,
	"photo_file_id" uuid,
	"custom" jsonb DEFAULT '{}' NOT NULL,
	"form_fee_paid" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_via" text DEFAULT 'staff' NOT NULL,
	"tracking_token_hash" text,
	"proposed_section_id" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"offer_expires_on" date,
	"student_id" uuid,
	CONSTRAINT "admission_applications_status_chk" CHECK ("status" in ('draft', 'submitted', 'under_review', 'test_scheduled', 'tested', 'offered', 'accepted', 'waitlisted', 'rejected', 'withdrawn', 'enrolled')),
	CONSTRAINT "admission_applications_gender_chk" CHECK ("gender" in ('male', 'female')),
	CONSTRAINT "admission_applications_religion_chk" CHECK ("religion" in ('islam', 'christianity', 'hinduism', 'sikhism', 'other')),
	CONSTRAINT "admission_applications_submitted_via_chk" CHECK ("submitted_via" in ('staff', 'public_form')),
	CONSTRAINT "admission_applications_guardians_list" CHECK (jsonb_typeof("guardians") = 'array' and "guardians" <> '[]'::jsonb)
);
--> statement-breakpoint
ALTER TABLE "admission_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admission_enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"enquiry_no" text NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"child_name" text NOT NULL,
	"gender" text,
	"date_of_birth" date,
	"guardian_name" text NOT NULL,
	"relation" text DEFAULT 'father' NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_phone" text,
	"email" text,
	"area" text,
	"source_id" uuid,
	"campaign" text,
	"created_via" text DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"lost_reason" text,
	"assigned_to" uuid,
	"next_follow_up_on" date,
	"score" integer DEFAULT 0 NOT NULL,
	"existing_family_id" uuid,
	"notes" text,
	CONSTRAINT "admission_enquiries_gender_chk" CHECK ("gender" in ('male', 'female')),
	CONSTRAINT "admission_enquiries_relation_chk" CHECK ("relation" in ('father', 'mother', 'guardian', 'other')),
	CONSTRAINT "admission_enquiries_created_via_chk" CHECK ("created_via" in ('staff', 'public_form', 'website', 'whatsapp')),
	CONSTRAINT "admission_enquiries_status_chk" CHECK ("status" in ('new', 'contacted', 'visit_scheduled', 'visited', 'applied', 'converted', 'lost')),
	CONSTRAINT "admission_enquiries_lost_reason_chk" CHECK ("lost_reason" in ('fee', 'distance', 'chose_other_school', 'no_seat', 'no_response', 'age', 'other')),
	CONSTRAINT "admission_enquiries_lost_reason_needed" CHECK ("status" <> 'lost' or "lost_reason" is not null),
	CONSTRAINT "admission_enquiries_score_range" CHECK ("score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "admission_enquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admission_seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"seats" integer NOT NULL,
	CONSTRAINT "admission_seats_seats_min" CHECK ("seats" >= 0)
);
--> statement-breakpoint
ALTER TABLE "admission_seats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admission_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"room_id" uuid,
	"conducted_by" uuid,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"score" numeric(6,2),
	"max_score" numeric(6,2),
	"result" text DEFAULT 'pending' NOT NULL,
	"remarks" text,
	CONSTRAINT "admission_tests_kind_chk" CHECK ("kind" in ('test', 'interview')),
	CONSTRAINT "admission_tests_status_chk" CHECK ("status" in ('scheduled', 'completed', 'no_show', 'cancelled')),
	CONSTRAINT "admission_tests_result_chk" CHECK ("result" in ('pending', 'pass', 'fail')),
	CONSTRAINT "admission_tests_max_score_from" CHECK ("max_score" >= "score")
);
--> statement-breakpoint
ALTER TABLE "admission_tests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "application_documents_kind_chk" CHECK ("kind" in ('b_form', 'birth_certificate', 'previous_result', 'leaving_certificate', 'guardian_cnic', 'vaccination_card', 'photo', 'other'))
);
--> statement-breakpoint
ALTER TABLE "application_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enquiry_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"outcome" text,
	"note" text,
	"next_follow_up_on" date,
	CONSTRAINT "enquiry_followups_kind_chk" CHECK ("kind" in ('call', 'whatsapp', 'sms', 'email', 'visit', 'note')),
	CONSTRAINT "enquiry_followups_outcome_chk" CHECK ("outcome" in ('reached', 'no_answer', 'interested', 'not_interested', 'visit_booked', 'call_back'))
);
--> statement-breakpoint
ALTER TABLE "enquiry_followups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "lead_sources_kind_chk" CHECK ("kind" in ('walk_in', 'referral', 'website', 'facebook', 'instagram', 'whatsapp', 'banner', 'newspaper', 'event', 'other'))
);
--> statement-breakpoint
ALTER TABLE "lead_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"page" text DEFAULT 'a4_portrait' NOT NULL,
	"body" text NOT NULL,
	"show_letterhead" boolean DEFAULT true NOT NULL,
	"show_photo" boolean DEFAULT false NOT NULL,
	"signatures" jsonb DEFAULT '[]' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "certificate_templates_language_chk" CHECK ("language" in ('en', 'ur', 'both')),
	CONSTRAINT "certificate_templates_page_chk" CHECK ("page" in ('a4_portrait', 'a4_landscape', 'a5_landscape')),
	CONSTRAINT "certificate_templates_status_chk" CHECK ("status" in ('draft', 'active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "certificate_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "certificate_types" (
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
	"issued_to" text NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"requires_clearance" boolean DEFAULT false NOT NULL,
	"one_active_per_person" boolean DEFAULT false NOT NULL,
	"number_format" text DEFAULT '{KEY}-{yyyy}-{0000}' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "certificate_types_issued_to_chk" CHECK ("issued_to" in ('student', 'staff'))
);
--> statement-breakpoint
ALTER TABLE "certificate_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"number" text,
	"purpose" text,
	"status" text NOT NULL,
	"requested_via" text DEFAULT 'staff' NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"issued_on" date,
	"issued_by" uuid,
	"document_id" uuid,
	"is_duplicate_copy" boolean DEFAULT false NOT NULL,
	"original_id" uuid,
	"collected_by" text,
	"collected_on" date,
	"revoked_reason" text,
	CONSTRAINT "certificates_status_chk" CHECK ("status" in ('requested', 'draft', 'pending_approval', 'issued', 'revoked', 'rejected')),
	CONSTRAINT "certificates_requested_via_chk" CHECK ("requested_via" in ('staff', 'portal')),
	CONSTRAINT "certificates_number_needed" CHECK ("status" <> 'issued' or "number" is not null),
	CONSTRAINT "certificates_person" CHECK (num_nonnulls("student_id", "staff_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "id_card_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"issued_to" text NOT NULL,
	"filters" jsonb NOT NULL,
	"card_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"document_id" uuid,
	CONSTRAINT "id_card_batches_issued_to_chk" CHECK ("issued_to" in ('student', 'staff')),
	CONSTRAINT "id_card_batches_status_chk" CHECK ("status" in ('queued', 'generating', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "id_card_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "id_card_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"issued_to" text NOT NULL,
	"name" text NOT NULL,
	"orientation" text DEFAULT 'portrait' NOT NULL,
	"fields" jsonb NOT NULL,
	"show_qr" boolean DEFAULT true NOT NULL,
	"accent" text DEFAULT 'primary' NOT NULL,
	"back_text" text,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "id_card_templates_issued_to_chk" CHECK ("issued_to" in ('student', 'staff')),
	CONSTRAINT "id_card_templates_orientation_chk" CHECK ("orientation" in ('portrait', 'landscape')),
	CONSTRAINT "id_card_templates_accent_chk" CHECK ("accent" in ('primary', 'brand', 'ink'))
);
--> statement-breakpoint
ALTER TABLE "id_card_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "id_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"issued_to" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"template_id" uuid NOT NULL,
	"academic_year_id" uuid,
	"card_no" text NOT NULL,
	"qr_token_hash" text NOT NULL,
	"issued_on" date NOT NULL,
	"valid_until" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"replaced_by_id" uuid,
	"batch_id" uuid,
	CONSTRAINT "id_cards_issued_to_chk" CHECK ("issued_to" in ('student', 'staff')),
	CONSTRAINT "id_cards_status_chk" CHECK ("status" in ('active', 'lost', 'replaced', 'expired', 'cancelled')),
	CONSTRAINT "id_cards_valid_until_from" CHECK ("valid_until" >= "issued_on"),
	CONSTRAINT "id_cards_person" CHECK (("issued_to" = 'student' and "student_id" is not null and "staff_id" is null) or ("issued_to" = 'staff' and "staff_id" is not null and "student_id" is null))
);
--> statement-breakpoint
ALTER TABLE "id_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"guardian_id" uuid,
	"student_id" uuid,
	"visitor_name" text NOT NULL,
	"phone" text,
	"purpose" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"room_id" uuid,
	"requested_via" text DEFAULT 'staff' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"note" text,
	CONSTRAINT "appointments_requested_via_chk" CHECK ("requested_via" in ('staff', 'portal')),
	CONSTRAINT "appointments_status_chk" CHECK ("status" in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
	CONSTRAINT "appointments_ends_at_after" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"caller_name" text NOT NULL,
	"phone" text,
	"regarding" text NOT NULL,
	"student_id" uuid,
	"called_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"follow_up_on" date,
	"is_follow_up_done" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "call_logs_direction_chk" CHECK ("direction" in ('incoming', 'outgoing'))
);
--> statement-breakpoint
ALTER TABLE "call_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gate_passes" (
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
	"pass_date" date NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"requested_via" text DEFAULT 'staff' NOT NULL,
	"pickup_guardian_id" uuid,
	"pickup_name" text NOT NULL,
	"pickup_relation" text NOT NULL,
	"pickup_cnic" text,
	"leave_time" time NOT NULL,
	"return_expected_time" time,
	"verification_code_hash" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"exited_at" timestamp with time zone,
	"exit_recorded_by" uuid,
	"returned_at" timestamp with time zone,
	CONSTRAINT "gate_passes_kind_chk" CHECK ("kind" in ('early_leave', 'medical', 'appointment', 'temporary_exit')),
	CONSTRAINT "gate_passes_requested_via_chk" CHECK ("requested_via" in ('staff', 'portal')),
	CONSTRAINT "gate_passes_status_chk" CHECK ("status" in ('requested', 'approved', 'rejected', 'exited', 'returned', 'cancelled', 'expired')),
	CONSTRAINT "gate_passes_pickup_cnic_needed" CHECK ("pickup_guardian_id" is not null or "pickup_cnic" is not null)
);
--> statement-breakpoint
ALTER TABLE "gate_passes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "postal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"logged_on" date NOT NULL,
	"party" text NOT NULL,
	"subject" text NOT NULL,
	"reference_no" text,
	"courier" text,
	"tracking_no" text,
	"addressed_to_staff_id" uuid,
	"handed_to" text,
	"handed_at" timestamp with time zone,
	"file_id" uuid,
	CONSTRAINT "postal_logs_direction_chk" CHECK ("direction" in ('received', 'dispatched'))
);
--> statement-breakpoint
ALTER TABLE "postal_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"cnic" text,
	"purpose" text NOT NULL,
	"purpose_detail" text,
	"host_staff_id" uuid,
	"student_id" uuid,
	"vehicle_no" text,
	"badge_no" text,
	"photo_file_id" uuid,
	"checked_in_at" timestamp with time zone NOT NULL,
	"checked_out_at" timestamp with time zone,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "visitors_purpose_chk" CHECK ("purpose" in ('meeting', 'parent_visit', 'admission_enquiry', 'delivery', 'maintenance', 'official', 'interview', 'other')),
	CONSTRAINT "visitors_checked_out_at_from" CHECK ("checked_out_at" >= "checked_in_at")
);
--> statement-breakpoint
ALTER TABLE "visitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alumni" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"graduation_year" integer NOT NULL,
	"last_grade_id" uuid NOT NULL,
	"board_result_summary" text,
	"current_status" text DEFAULT 'unknown' NOT NULL,
	"institution" text,
	"field_of_study" text,
	"occupation" text,
	"city" text,
	"phone" text,
	"email" text,
	"consent_to_contact" text DEFAULT 'not_asked' NOT NULL,
	"consent_to_showcase" boolean DEFAULT false NOT NULL,
	"achievements" text,
	"notes" text,
	CONSTRAINT "alumni_current_status_chk" CHECK ("current_status" in ('studying', 'working', 'both', 'other', 'unknown')),
	CONSTRAINT "alumni_consent_to_contact_chk" CHECK ("consent_to_contact" in ('not_asked', 'yes', 'no'))
);
--> statement-breakpoint
ALTER TABLE "alumni" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "alumni_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"alumni_id" uuid NOT NULL,
	"changes" jsonb NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "alumni_updates_source_chk" CHECK ("source" in ('staff', 'form'))
);
--> statement-breakpoint
ALTER TABLE "alumni_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_uq" ON "api_keys" ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_devices_serial_no_uq" ON "biometric_devices" ("org_id","serial_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "biometric_devices_branch_id_fk_idx" ON "biometric_devices" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_enrolments_branch_device_user_code_uq" ON "biometric_enrolments" ("branch_id","device_user_code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_enrolments_branch_staff_uq" ON "biometric_enrolments" ("branch_id","staff_id") WHERE "deleted_at" is null and "staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_enrolments_branch_student_uq" ON "biometric_enrolments" ("branch_id","student_id") WHERE "deleted_at" is null and "student_id" is not null;--> statement-breakpoint
CREATE INDEX "biometric_enrolments_staff_id_fk_idx" ON "biometric_enrolments" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "biometric_enrolments_student_id_fk_idx" ON "biometric_enrolments" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_punches_device_device_user_code_punched_at_uq" ON "biometric_punches" ("device_id","device_user_code","punched_at");--> statement-breakpoint
CREATE INDEX "biometric_punches_branch_is_processed_punched_at_idx" ON "biometric_punches" ("branch_id","is_processed","punched_at");--> statement-breakpoint
CREATE INDEX "biometric_punches_staff_id_fk_idx" ON "biometric_punches" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "biometric_punches_student_id_fk_idx" ON "biometric_punches" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_default_uq" ON "integration_connections" ("org_id","category",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "is_default" and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "integration_connections_branch_id_fk_idx" ON "integration_connections" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_endpoint_event_uq" ON "webhook_deliveries" ("endpoint_id","event_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_id_fk_idx" ON "webhook_deliveries" ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uq" ON "webhook_events" ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_applications_tracking_token_hash_uq" ON "admission_applications" ("tracking_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admission_applications_application_no_uq" ON "admission_applications" ("org_id","application_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "admission_applications_branch_academic_year_status_idx" ON "admission_applications" ("org_id","branch_id","academic_year_id","status");--> statement-breakpoint
CREATE INDEX "admission_applications_b_form_no_idx" ON "admission_applications" ("org_id","b_form_no");--> statement-breakpoint
CREATE INDEX "admission_applications_branch_id_fk_idx" ON "admission_applications" ("branch_id");--> statement-breakpoint
CREATE INDEX "admission_applications_enquiry_id_fk_idx" ON "admission_applications" ("enquiry_id") WHERE "enquiry_id" is not null;--> statement-breakpoint
CREATE INDEX "admission_applications_academic_year_id_fk_idx" ON "admission_applications" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "admission_applications_grade_id_fk_idx" ON "admission_applications" ("grade_id");--> statement-breakpoint
CREATE INDEX "admission_applications_family_id_fk_idx" ON "admission_applications" ("family_id") WHERE "family_id" is not null;--> statement-breakpoint
CREATE INDEX "admission_applications_photo_file_id_fk_idx" ON "admission_applications" ("photo_file_id") WHERE "photo_file_id" is not null;--> statement-breakpoint
CREATE INDEX "admission_applications_proposed_section_id_fk_idx" ON "admission_applications" ("proposed_section_id") WHERE "proposed_section_id" is not null;--> statement-breakpoint
CREATE INDEX "admission_applications_decided_by_fk_idx" ON "admission_applications" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "admission_applications_student_id_fk_idx" ON "admission_applications" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_enquiries_enquiry_no_uq" ON "admission_enquiries" ("org_id","enquiry_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "admission_enquiries_branch_status_next_follow_up_on_idx" ON "admission_enquiries" ("org_id","branch_id","status","next_follow_up_on");--> statement-breakpoint
CREATE INDEX "admission_enquiries_phone_idx" ON "admission_enquiries" ("org_id","phone");--> statement-breakpoint
CREATE INDEX "admission_enquiries_branch_id_fk_idx" ON "admission_enquiries" ("branch_id");--> statement-breakpoint
CREATE INDEX "admission_enquiries_academic_year_id_fk_idx" ON "admission_enquiries" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "admission_enquiries_grade_id_fk_idx" ON "admission_enquiries" ("grade_id");--> statement-breakpoint
CREATE INDEX "admission_enquiries_source_id_fk_idx" ON "admission_enquiries" ("source_id") WHERE "source_id" is not null;--> statement-breakpoint
CREATE INDEX "admission_enquiries_assigned_to_fk_idx" ON "admission_enquiries" ("assigned_to") WHERE "assigned_to" is not null;--> statement-breakpoint
CREATE INDEX "admission_enquiries_existing_family_id_fk_idx" ON "admission_enquiries" ("existing_family_id") WHERE "existing_family_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "admission_seats_branch_academic_year_grade_uq" ON "admission_seats" ("branch_id","academic_year_id","grade_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "admission_seats_academic_year_id_fk_idx" ON "admission_seats" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "admission_seats_grade_id_fk_idx" ON "admission_seats" ("grade_id");--> statement-breakpoint
CREATE INDEX "admission_tests_branch_id_fk_idx" ON "admission_tests" ("branch_id");--> statement-breakpoint
CREATE INDEX "admission_tests_application_id_fk_idx" ON "admission_tests" ("application_id");--> statement-breakpoint
CREATE INDEX "admission_tests_room_id_fk_idx" ON "admission_tests" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "admission_tests_conducted_by_fk_idx" ON "admission_tests" ("conducted_by") WHERE "conducted_by" is not null;--> statement-breakpoint
CREATE INDEX "application_documents_branch_id_fk_idx" ON "application_documents" ("branch_id");--> statement-breakpoint
CREATE INDEX "application_documents_application_id_fk_idx" ON "application_documents" ("application_id");--> statement-breakpoint
CREATE INDEX "application_documents_file_id_fk_idx" ON "application_documents" ("file_id");--> statement-breakpoint
CREATE INDEX "enquiry_followups_branch_id_fk_idx" ON "enquiry_followups" ("branch_id");--> statement-breakpoint
CREATE INDEX "enquiry_followups_enquiry_id_fk_idx" ON "enquiry_followups" ("enquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_sources_name_uq" ON "lead_sources" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "students_source_application_id_fk_idx" ON "students" ("source_application_id") WHERE "source_application_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_templates_default_uq" ON "certificate_templates" ("type_id","language") WHERE "is_default" and "status" = 'active' and "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_types_key_uq" ON "certificate_types" ("org_id","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_number_uq" ON "certificates" ("org_id","number") WHERE "deleted_at" is null and "number" is not null;--> statement-breakpoint
CREATE INDEX "certificates_branch_id_fk_idx" ON "certificates" ("branch_id");--> statement-breakpoint
CREATE INDEX "certificates_type_id_fk_idx" ON "certificates" ("type_id");--> statement-breakpoint
CREATE INDEX "certificates_template_id_fk_idx" ON "certificates" ("template_id");--> statement-breakpoint
CREATE INDEX "certificates_student_id_fk_idx" ON "certificates" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "certificates_staff_id_fk_idx" ON "certificates" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "certificates_issued_by_fk_idx" ON "certificates" ("issued_by") WHERE "issued_by" is not null;--> statement-breakpoint
CREATE INDEX "certificates_document_id_fk_idx" ON "certificates" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "certificates_original_id_fk_idx" ON "certificates" ("original_id") WHERE "original_id" is not null;--> statement-breakpoint
CREATE INDEX "id_card_batches_branch_id_fk_idx" ON "id_card_batches" ("branch_id");--> statement-breakpoint
CREATE INDEX "id_card_batches_template_id_fk_idx" ON "id_card_batches" ("template_id");--> statement-breakpoint
CREATE INDEX "id_card_batches_document_id_fk_idx" ON "id_card_batches" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "id_cards_qr_token_hash_uq" ON "id_cards" ("qr_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "id_cards_active_student_uq" ON "id_cards" ("student_id") WHERE "status" = 'active' and "student_id" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "id_cards_active_staff_uq" ON "id_cards" ("staff_id") WHERE "status" = 'active' and "staff_id" is not null and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "id_cards_branch_id_fk_idx" ON "id_cards" ("branch_id");--> statement-breakpoint
CREATE INDEX "id_cards_template_id_fk_idx" ON "id_cards" ("template_id");--> statement-breakpoint
CREATE INDEX "id_cards_academic_year_id_fk_idx" ON "id_cards" ("academic_year_id") WHERE "academic_year_id" is not null;--> statement-breakpoint
CREATE INDEX "id_cards_replaced_by_id_fk_idx" ON "id_cards" ("replaced_by_id") WHERE "replaced_by_id" is not null;--> statement-breakpoint
CREATE INDEX "id_cards_batch_id_fk_idx" ON "id_cards" ("batch_id") WHERE "batch_id" is not null;--> statement-breakpoint
CREATE INDEX "appointments_branch_id_fk_idx" ON "appointments" ("branch_id");--> statement-breakpoint
CREATE INDEX "appointments_staff_id_fk_idx" ON "appointments" ("staff_id");--> statement-breakpoint
CREATE INDEX "appointments_guardian_id_fk_idx" ON "appointments" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "appointments_student_id_fk_idx" ON "appointments" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "appointments_room_id_fk_idx" ON "appointments" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "call_logs_branch_id_fk_idx" ON "call_logs" ("branch_id");--> statement-breakpoint
CREATE INDEX "call_logs_student_id_fk_idx" ON "call_logs" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "gate_passes_branch_pass_date_status_idx" ON "gate_passes" ("org_id","branch_id","pass_date","status");--> statement-breakpoint
CREATE INDEX "gate_passes_branch_id_fk_idx" ON "gate_passes" ("branch_id");--> statement-breakpoint
CREATE INDEX "gate_passes_student_id_fk_idx" ON "gate_passes" ("student_id");--> statement-breakpoint
CREATE INDEX "gate_passes_pickup_guardian_id_fk_idx" ON "gate_passes" ("pickup_guardian_id") WHERE "pickup_guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "gate_passes_decided_by_fk_idx" ON "gate_passes" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "gate_passes_exit_recorded_by_fk_idx" ON "gate_passes" ("exit_recorded_by") WHERE "exit_recorded_by" is not null;--> statement-breakpoint
CREATE INDEX "postal_logs_branch_id_fk_idx" ON "postal_logs" ("branch_id");--> statement-breakpoint
CREATE INDEX "postal_logs_addressed_to_staff_id_fk_idx" ON "postal_logs" ("addressed_to_staff_id") WHERE "addressed_to_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "postal_logs_file_id_fk_idx" ON "postal_logs" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "visitors_branch_checked_in_at_idx" ON "visitors" ("org_id","branch_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "visitors_full_name_trgm" ON "visitors" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "visitors_branch_id_fk_idx" ON "visitors" ("branch_id");--> statement-breakpoint
CREATE INDEX "visitors_host_staff_id_fk_idx" ON "visitors" ("host_staff_id") WHERE "host_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "visitors_student_id_fk_idx" ON "visitors" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "visitors_photo_file_id_fk_idx" ON "visitors" ("photo_file_id") WHERE "photo_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "alumni_student_uq" ON "alumni" ("org_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "alumni_graduation_year_idx" ON "alumni" ("org_id","graduation_year");--> statement-breakpoint
CREATE INDEX "alumni_student_id_fk_idx" ON "alumni" ("student_id");--> statement-breakpoint
CREATE INDEX "alumni_branch_id_fk_idx" ON "alumni" ("branch_id");--> statement-breakpoint
CREATE INDEX "alumni_last_grade_id_fk_idx" ON "alumni" ("last_grade_id");--> statement-breakpoint
CREATE INDEX "alumni_updates_alumni_id_fk_idx" ON "alumni_updates" ("alumni_id");--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "biometric_enrolments" ADD CONSTRAINT "biometric_enrolments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "biometric_enrolments" ADD CONSTRAINT "biometric_enrolments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "biometric_enrolments" ADD CONSTRAINT "biometric_enrolments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "biometric_enrolments" ADD CONSTRAINT "biometric_enrolments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "biometric_punches" ADD CONSTRAINT "biometric_punches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "biometric_punches" ADD CONSTRAINT "biometric_punches_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "biometric_punches" ADD CONSTRAINT "biometric_punches_device_id_biometric_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id");--> statement-breakpoint
ALTER TABLE "biometric_punches" ADD CONSTRAINT "biometric_punches_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "biometric_punches" ADD CONSTRAINT "biometric_punches_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id");--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_domain_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "domain_events"("id");--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_enquiry_id_admission_enquiries_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_photo_file_id_files_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_proposed_section_id_sections_id_fkey" FOREIGN KEY ("proposed_section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_source_id_lead_sources_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_assigned_to_staff_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_existing_family_id_families_id_fkey" FOREIGN KEY ("existing_family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "admission_seats" ADD CONSTRAINT "admission_seats_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "admission_seats" ADD CONSTRAINT "admission_seats_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "admission_seats" ADD CONSTRAINT "admission_seats_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "admission_seats" ADD CONSTRAINT "admission_seats_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "admission_tests" ADD CONSTRAINT "admission_tests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "admission_tests" ADD CONSTRAINT "admission_tests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "admission_tests" ADD CONSTRAINT "admission_tests_application_id_admission_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id");--> statement-breakpoint
ALTER TABLE "admission_tests" ADD CONSTRAINT "admission_tests_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "admission_tests" ADD CONSTRAINT "admission_tests_conducted_by_staff_id_fkey" FOREIGN KEY ("conducted_by") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_admission_applica_7fa1ceaa" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id");--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "enquiry_followups" ADD CONSTRAINT "enquiry_followups_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "enquiry_followups" ADD CONSTRAINT "enquiry_followups_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "enquiry_followups" ADD CONSTRAINT "enquiry_followups_enquiry_id_admission_enquiries_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "admission_enquiries"("id");--> statement-breakpoint
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_source_application_id_admission_applications_id_fkey" FOREIGN KEY ("source_application_id") REFERENCES "admission_applications"("id");--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_type_id_certificate_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "certificate_types"("id");--> statement-breakpoint
ALTER TABLE "certificate_types" ADD CONSTRAINT "certificate_types_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_type_id_certificate_types_id_fkey" FOREIGN KEY ("type_id") REFERENCES "certificate_types"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_template_id_certificate_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_profiles_id_fkey" FOREIGN KEY ("issued_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_original_id_certificates_id_fkey" FOREIGN KEY ("original_id") REFERENCES "certificates"("id");--> statement-breakpoint
ALTER TABLE "id_card_batches" ADD CONSTRAINT "id_card_batches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "id_card_batches" ADD CONSTRAINT "id_card_batches_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "id_card_batches" ADD CONSTRAINT "id_card_batches_template_id_id_card_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "id_card_templates"("id");--> statement-breakpoint
ALTER TABLE "id_card_batches" ADD CONSTRAINT "id_card_batches_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "id_card_templates" ADD CONSTRAINT "id_card_templates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_template_id_id_card_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "id_card_templates"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_replaced_by_id_id_cards_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "id_cards"("id");--> statement-breakpoint
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_batch_id_id_card_batches_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "id_card_batches"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_pickup_guardian_id_guardians_id_fkey" FOREIGN KEY ("pickup_guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_exit_recorded_by_profiles_id_fkey" FOREIGN KEY ("exit_recorded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "postal_logs" ADD CONSTRAINT "postal_logs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "postal_logs" ADD CONSTRAINT "postal_logs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "postal_logs" ADD CONSTRAINT "postal_logs_addressed_to_staff_id_staff_id_fkey" FOREIGN KEY ("addressed_to_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "postal_logs" ADD CONSTRAINT "postal_logs_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_host_staff_id_staff_id_fkey" FOREIGN KEY ("host_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_photo_file_id_files_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_last_grade_id_grades_id_fkey" FOREIGN KEY ("last_grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "alumni_updates" ADD CONSTRAINT "alumni_updates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "alumni_updates" ADD CONSTRAINT "alumni_updates_alumni_id_alumni_id_fkey" FOREIGN KEY ("alumni_id") REFERENCES "alumni"("id");--> statement-breakpoint
CREATE POLICY "api_keys_staff" ON "api_keys" AS PERMISSIVE FOR ALL TO "authenticated" USING ("api_keys"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("api_keys"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "biometric_devices_staff" ON "biometric_devices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("biometric_devices"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("biometric_devices"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "biometric_devices_branch" ON "biometric_devices" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "biometric_devices"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "biometric_devices"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "biometric_enrolments_staff" ON "biometric_enrolments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("biometric_enrolments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("biometric_enrolments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "biometric_enrolments_branch" ON "biometric_enrolments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "biometric_enrolments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "biometric_enrolments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "biometric_punches_staff_read" ON "biometric_punches" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("biometric_punches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "biometric_punches_staff_insert" ON "biometric_punches" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("biometric_punches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "biometric_punches_branch" ON "biometric_punches" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "biometric_punches"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "biometric_punches"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "integration_connections_staff" ON "integration_connections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("integration_connections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("integration_connections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "webhook_deliveries_staff" ON "webhook_deliveries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("webhook_deliveries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("webhook_deliveries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "webhook_endpoints_staff" ON "webhook_endpoints" AS PERMISSIVE FOR ALL TO "authenticated" USING ("webhook_endpoints"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("webhook_endpoints"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "webhook_events_platform" ON "webhook_events" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "admission_applications_staff" ON "admission_applications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("admission_applications"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("admission_applications"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "admission_applications_branch" ON "admission_applications" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "admission_applications"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "admission_applications"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "admission_enquiries_staff" ON "admission_enquiries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("admission_enquiries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("admission_enquiries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "admission_enquiries_branch" ON "admission_enquiries" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "admission_enquiries"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "admission_enquiries"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "admission_seats_staff" ON "admission_seats" AS PERMISSIVE FOR ALL TO "authenticated" USING ("admission_seats"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("admission_seats"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "admission_seats_branch" ON "admission_seats" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "admission_seats"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "admission_seats"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "admission_tests_staff" ON "admission_tests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("admission_tests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("admission_tests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "admission_tests_branch" ON "admission_tests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "admission_tests"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "admission_tests"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "application_documents_staff" ON "application_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("application_documents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("application_documents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "application_documents_branch" ON "application_documents" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "application_documents"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "application_documents"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "enquiry_followups_staff_read" ON "enquiry_followups" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("enquiry_followups"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "enquiry_followups_staff_insert" ON "enquiry_followups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("enquiry_followups"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "enquiry_followups_branch" ON "enquiry_followups" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "enquiry_followups"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "enquiry_followups"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "lead_sources_staff" ON "lead_sources" AS PERMISSIVE FOR ALL TO "authenticated" USING ("lead_sources"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("lead_sources"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "certificate_templates_staff" ON "certificate_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("certificate_templates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("certificate_templates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "certificate_types_staff" ON "certificate_types" AS PERMISSIVE FOR ALL TO "authenticated" USING ("certificate_types"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("certificate_types"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "certificates_staff" ON "certificates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("certificates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("certificates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "certificates_family_read" ON "certificates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("certificates"."org_id" = (select app.org_id()) and "certificates"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "certificates_family_insert" ON "certificates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("certificates"."org_id" = (select app.org_id()) and "certificates"."student_id" = any ((select app.student_ids())::uuid[]) and "certificates"."status" = 'requested');--> statement-breakpoint
CREATE POLICY "certificates_branch" ON "certificates" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "certificates"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "certificates"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "id_card_batches_staff" ON "id_card_batches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("id_card_batches"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("id_card_batches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "id_card_batches_branch" ON "id_card_batches" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "id_card_batches"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "id_card_batches"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "id_card_templates_staff" ON "id_card_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("id_card_templates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("id_card_templates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "id_cards_staff" ON "id_cards" AS PERMISSIVE FOR ALL TO "authenticated" USING ("id_cards"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("id_cards"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "id_cards_family_read" ON "id_cards" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("id_cards"."org_id" = (select app.org_id()) and "id_cards"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "id_cards_branch" ON "id_cards" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "id_cards"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "id_cards"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "appointments_staff" ON "appointments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("appointments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("appointments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "appointments_family_read" ON "appointments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("appointments"."org_id" = (select app.org_id()) and "appointments"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "appointments_family_insert" ON "appointments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("appointments"."org_id" = (select app.org_id()) and "appointments"."student_id" = any ((select app.student_ids())::uuid[]) and "appointments"."status" = 'requested');--> statement-breakpoint
CREATE POLICY "appointments_branch" ON "appointments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "appointments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "appointments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "call_logs_staff" ON "call_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("call_logs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("call_logs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "call_logs_branch" ON "call_logs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "call_logs"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "call_logs"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "gate_passes_staff" ON "gate_passes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("gate_passes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("gate_passes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "gate_passes_family_read" ON "gate_passes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("gate_passes"."org_id" = (select app.org_id()) and "gate_passes"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "gate_passes_family_insert" ON "gate_passes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("gate_passes"."org_id" = (select app.org_id()) and "gate_passes"."student_id" = any ((select app.student_ids())::uuid[]) and "gate_passes"."status" = 'requested');--> statement-breakpoint
CREATE POLICY "gate_passes_branch" ON "gate_passes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "gate_passes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "gate_passes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "postal_logs_staff" ON "postal_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("postal_logs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("postal_logs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "postal_logs_branch" ON "postal_logs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "postal_logs"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "postal_logs"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "visitors_staff" ON "visitors" AS PERMISSIVE FOR ALL TO "authenticated" USING ("visitors"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("visitors"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "visitors_branch" ON "visitors" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "visitors"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "visitors"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "alumni_staff" ON "alumni" AS PERMISSIVE FOR ALL TO "authenticated" USING ("alumni"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("alumni"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "alumni_updates_staff_read" ON "alumni_updates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("alumni_updates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "alumni_updates_staff_insert" ON "alumni_updates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("alumni_updates"."org_id" = (select app.org_id()) and (select app.is_staff()));