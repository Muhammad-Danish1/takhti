CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	CONSTRAINT "academic_years_status_chk" CHECK ("status" in ('planned', 'active', 'closed')),
	CONSTRAINT "academic_years_end_date_after" CHECK ("end_date" > "start_date"),
	CONSTRAINT "academic_years_end_date_span" CHECK ("end_date" <= ("start_date" + interval '15 months'))
);
--> statement-breakpoint
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"province" text,
	"kind" text NOT NULL,
	"website" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "boards_kind_chk" CHECK ("kind" in ('bise', 'federal', 'private'))
);
--> statement-breakpoint
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grade_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"scheme_id" uuid NOT NULL,
	"grade" text NOT NULL,
	"min_percent" numeric(5,2) NOT NULL,
	"max_percent" numeric(5,2) NOT NULL,
	"grade_point" numeric(4,2),
	"description" text,
	"description_ur" text,
	"is_pass" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "grade_bands_min_percent_range" CHECK ("min_percent" between 0 and 100),
	CONSTRAINT "grade_bands_max_percent_after" CHECK ("max_percent" > "min_percent"),
	CONSTRAINT "grade_bands_max_percent_range" CHECK ("max_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "grade_bands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grading_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"description" text,
	"board_id" uuid,
	"pass_percent" numeric(5,2) NOT NULL,
	"applies_from" date NOT NULL,
	"uses_grade_points" boolean DEFAULT false NOT NULL,
	"percent_rounding" text DEFAULT 'one_decimal' NOT NULL,
	"position_rule" text DEFAULT 'competition' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"supersedes_id" uuid,
	CONSTRAINT "grading_schemes_percent_rounding_chk" CHECK ("percent_rounding" in ('none', 'one_decimal', 'whole_half_up')),
	CONSTRAINT "grading_schemes_position_rule_chk" CHECK ("position_rule" in ('none', 'competition', 'dense')),
	CONSTRAINT "grading_schemes_status_chk" CHECK ("status" in ('draft', 'active', 'archived')),
	CONSTRAINT "grading_schemes_pass_percent_range" CHECK ("pass_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "grading_schemes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid,
	"name" text NOT NULL,
	"name_ur" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"kind" text NOT NULL,
	"is_tentative" boolean DEFAULT false NOT NULL,
	"applies_to" text DEFAULT 'everyone' NOT NULL,
	CONSTRAINT "holidays_kind_chk" CHECK ("kind" in ('public', 'religious', 'vacation', 'local', 'emergency')),
	CONSTRAINT "holidays_applies_to_chk" CHECK ("applies_to" in ('everyone', 'students_only')),
	CONSTRAINT "holidays_end_date_from" CHECK ("end_date" >= "start_date")
);
--> statement-breakpoint
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shifts" (
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
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "shifts_end_time_after" CHECK ("end_time" > "start_time")
);
--> statement-breakpoint
ALTER TABLE "shifts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"sequence" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"weight_percent" numeric(5,2) DEFAULT '0' NOT NULL,
	CONSTRAINT "terms_sequence_pos" CHECK ("sequence" > 0),
	CONSTRAINT "terms_end_date_after" CHECK ("end_date" > "start_date"),
	CONSTRAINT "terms_weight_percent_range" CHECK ("weight_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enrollments" (
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
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"roll_no" integer,
	"subject_group_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_on" date NOT NULL,
	"left_on" date,
	"outcome_note" text,
	CONSTRAINT "enrollments_status_chk" CHECK ("status" in ('active', 'promoted', 'detained', 'left', 'transferred', 'graduated')),
	CONSTRAINT "enrollments_roll_no_pos" CHECK ("roll_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"family_code" text NOT NULL,
	"primary_guardian_id" uuid,
	"address" text,
	"city" text,
	"home_phone" text,
	"is_tax_filer" boolean DEFAULT false NOT NULL,
	"income_band" text DEFAULT 'not_stated' NOT NULL,
	"notes" text,
	CONSTRAINT "families_income_band_chk" CHECK ("income_band" in ('not_stated', 'under_50k', '50k_100k', '100k_250k', 'over_250k'))
);
--> statement-breakpoint
ALTER TABLE "families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"family_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"full_name_ur" text,
	"cnic" text,
	"phone" text NOT NULL,
	"whatsapp_phone" text,
	"phone_alt" text,
	"email" text,
	"occupation" text,
	"employer" text,
	"education" text,
	"is_deceased" boolean DEFAULT false NOT NULL,
	"photo_file_id" uuid,
	"preferred_locale" text DEFAULT 'ur' NOT NULL,
	"custom" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "guardians_preferred_locale_chk" CHECK ("preferred_locale" in ('en', 'ur'))
);
--> statement-breakpoint
ALTER TABLE "guardians" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profile_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid,
	"guardian_id" uuid,
	"changes" jsonb NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decision_note" text,
	CONSTRAINT "profile_change_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected')),
	CONSTRAINT "profile_change_requests_guardian_id_about" CHECK (num_nonnulls("student_id", "guardian_id") >= 1)
);
--> statement-breakpoint
ALTER TABLE "profile_change_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "promotion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"from_academic_year_id" uuid NOT NULL,
	"to_academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"section_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"committed_at" timestamp with time zone,
	"committed_by" uuid,
	"summary" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "promotion_batches_status_chk" CHECK ("status" in ('draft', 'committed', 'reversed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "promotion_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "promotion_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"suggested_decision" text NOT NULL,
	"to_grade_id" uuid,
	"to_section_id" uuid,
	"reason" text,
	"new_enrollment_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	CONSTRAINT "promotion_items_decision_chk" CHECK ("decision" in ('promote', 'detain', 'graduate', 'leave')),
	CONSTRAINT "promotion_items_suggested_decision_chk" CHECK ("suggested_decision" in ('promote', 'detain', 'graduate', 'leave')),
	CONSTRAINT "promotion_items_status_chk" CHECK ("status" in ('pending', 'done', 'failed')),
	CONSTRAINT "promotion_items_reason_needed" CHECK ("decision" = "suggested_decision" or "reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "promotion_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "section_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"from_section_id" uuid NOT NULL,
	"to_section_id" uuid NOT NULL,
	"changed_on" date NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "section_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_documents" (
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
	"kind" text NOT NULL,
	"file_id" uuid NOT NULL,
	"document_no" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "student_documents_kind_chk" CHECK ("kind" in ('b_form', 'birth_certificate', 'previous_result', 'leaving_certificate', 'guardian_cnic', 'vaccination_card', 'photo', 'other'))
);
--> statement-breakpoint
ALTER TABLE "student_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"can_pickup" boolean DEFAULT true NOT NULL,
	"receives_messages" boolean DEFAULT true NOT NULL,
	"is_emergency_contact" boolean DEFAULT false NOT NULL,
	"lives_with_student" boolean DEFAULT true NOT NULL,
	CONSTRAINT "student_guardians_relation_chk" CHECK ("relation" in ('father', 'mother', 'grandfather', 'grandmother', 'uncle', 'aunt', 'brother', 'sister', 'guardian', 'other'))
);
--> statement-breakpoint
ALTER TABLE "student_guardians" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"effective_on" date NOT NULL,
	"reason" text,
	"detail" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_withdrawals" (
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
	"requested_on" date NOT NULL,
	"last_attendance_on" date NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"clearance" jsonb DEFAULT '{}' NOT NULL,
	"dues_outstanding" bigint DEFAULT 0 NOT NULL,
	"security_refund" bigint DEFAULT 0 NOT NULL,
	"approved_by" uuid,
	"completed_at" timestamp with time zone,
	CONSTRAINT "student_withdrawals_reason_chk" CHECK ("reason" in ('relocation', 'financial', 'academic', 'other_school', 'health', 'expelled', 'completed', 'other')),
	CONSTRAINT "student_withdrawals_status_chk" CHECK ("status" in ('requested', 'clearance', 'approved', 'completed', 'cancelled')),
	CONSTRAINT "student_withdrawals_dues_outstanding_min" CHECK ("dues_outstanding" >= 0),
	CONSTRAINT "student_withdrawals_security_refund_min" CHECK ("security_refund" >= 0)
);
--> statement-breakpoint
ALTER TABLE "student_withdrawals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	"family_id" uuid NOT NULL,
	"admission_no" text NOT NULL,
	"full_name" text NOT NULL,
	"full_name_ur" text,
	"father_name" text NOT NULL,
	"gender" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"place_of_birth" text,
	"b_form_no" text,
	"religion" text DEFAULT 'islam' NOT NULL,
	"mother_tongue" text,
	"blood_group" text DEFAULT 'unknown' NOT NULL,
	"photo_file_id" uuid,
	"phone" text,
	"address" text,
	"previous_school" text,
	"previous_class" text,
	"admitted_on" date NOT NULL,
	"admission_grade_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"left_on" date,
	"leaving_reason" text,
	"house_id" uuid,
	"is_orphan" boolean DEFAULT false NOT NULL,
	"staff_parent_id" uuid,
	"medical_alert" text,
	"special_needs" text,
	"board_registration_no" text,
	"source_application_id" uuid,
	"custom" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "students_gender_chk" CHECK ("gender" in ('male', 'female')),
	CONSTRAINT "students_religion_chk" CHECK ("religion" in ('islam', 'christianity', 'hinduism', 'sikhism', 'other')),
	CONSTRAINT "students_blood_group_chk" CHECK ("blood_group" in ('a_pos', 'a_neg', 'b_pos', 'b_neg', 'ab_pos', 'ab_neg', 'o_pos', 'o_neg', 'unknown')),
	CONSTRAINT "students_status_chk" CHECK ("status" in ('active', 'on_leave', 'suspended', 'left', 'transferred', 'graduated', 'expelled')),
	CONSTRAINT "students_left_on_needed" CHECK ("status" not in ('left', 'transferred', 'graduated', 'expelled') or "left_on" is not null)
);
--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transfer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid NOT NULL,
	"from_branch_id" uuid NOT NULL,
	"to_branch_id" uuid NOT NULL,
	"to_section_id" uuid,
	"effective_on" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	CONSTRAINT "transfer_requests_status_chk" CHECK ("status" in ('requested', 'approved', 'completed', 'rejected', 'cancelled')),
	CONSTRAINT "transfer_requests_to_branch_id_differs" CHECK ("to_branch_id" <> "from_branch_id")
);
--> statement-breakpoint
ALTER TABLE "transfer_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grade_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"academic_year_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"subject_group_id" uuid,
	"is_compulsory" boolean DEFAULT true NOT NULL,
	"periods_per_week" integer NOT NULL,
	"theory_marks" numeric(6,2) NOT NULL,
	"practical_marks" numeric(6,2) DEFAULT '0' NOT NULL,
	"pass_percent" numeric(5,2),
	"counts_in_result" boolean DEFAULT true NOT NULL,
	"book_title" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "grade_subjects_periods_per_week_min" CHECK ("periods_per_week" >= 0),
	CONSTRAINT "grade_subjects_theory_marks_min" CHECK ("theory_marks" >= 0),
	CONSTRAINT "grade_subjects_practical_marks_min" CHECK ("practical_marks" >= 0),
	CONSTRAINT "grade_subjects_pass_percent_range" CHECK ("pass_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "grade_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"level" integer NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"short_name" text NOT NULL,
	"stage" text NOT NULL,
	"next_grade_id" uuid,
	"grading_scheme_id" uuid NOT NULL,
	"is_offered" boolean DEFAULT true NOT NULL,
	CONSTRAINT "grades_stage_chk" CHECK ("stage" in ('primary', 'middle', 'secondary')),
	CONSTRAINT "grades_level_range" CHECK ("level" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "section_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"grade_subject_id" uuid NOT NULL,
	"teacher_id" uuid,
	"periods_per_week" integer,
	CONSTRAINT "section_subjects_periods_per_week_min" CHECK ("periods_per_week" >= 0)
);
--> statement-breakpoint
ALTER TABLE "section_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sections" (
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
	"name" text NOT NULL,
	"capacity" integer DEFAULT 40 NOT NULL,
	"class_teacher_id" uuid,
	"room_id" uuid,
	"shift_id" uuid,
	"wing_id" uuid,
	"medium" text DEFAULT 'english' NOT NULL,
	"gender" text DEFAULT 'mixed' NOT NULL,
	"roll_number_rule" text DEFAULT 'alphabetical' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "sections_medium_chk" CHECK ("medium" in ('english', 'urdu')),
	CONSTRAINT "sections_gender_chk" CHECK ("gender" in ('boys', 'girls', 'mixed')),
	CONSTRAINT "sections_roll_number_rule_chk" CHECK ("roll_number_rule" in ('alphabetical', 'admission_order', 'girls_first', 'manual')),
	CONSTRAINT "sections_status_chk" CHECK ("status" in ('active', 'closed')),
	CONSTRAINT "sections_capacity_pos" CHECK ("capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_subject_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"grade_subject_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	CONSTRAINT "student_subject_overrides_action_chk" CHECK ("action" in ('add', 'drop')),
	CONSTRAINT "student_subject_overrides_reason_chk" CHECK ("reason" in ('religion_alternative', 'elective_choice', 'medical_exemption', 'other'))
);
--> statement-breakpoint
ALTER TABLE "student_subject_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subject_groups" (
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
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subject_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subjects" (
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
	"kind" text DEFAULT 'core' NOT NULL,
	"has_practical" boolean DEFAULT false NOT NULL,
	"alternative_of_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subjects_kind_chk" CHECK ("kind" in ('core', 'language', 'religious', 'elective', 'activity'))
);
--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "applicant_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"applicant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"panel_staff_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"score" numeric(5,2),
	"feedback" text,
	CONSTRAINT "applicant_interviews_kind_chk" CHECK ("kind" in ('interview', 'demo_lesson', 'written_test')),
	CONSTRAINT "applicant_interviews_result_chk" CHECK ("result" in ('pending', 'pass', 'fail', 'no_show'))
);
--> statement-breakpoint
ALTER TABLE "applicant_interviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"name_ur" text,
	"code" text NOT NULL,
	"head_staff_id" uuid,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"name_ur" text,
	"category" text NOT NULL,
	"is_teaching" boolean DEFAULT false NOT NULL,
	"pay_grade" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "designations_category_chk" CHECK ("category" in ('leadership', 'teaching', 'academic_support', 'administration', 'finance', 'support', 'transport', 'security', 'medical'))
);
--> statement-breakpoint
ALTER TABLE "designations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "employment_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"terms" text,
	"document_id" uuid,
	"signed_file_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "employment_contracts_kind_chk" CHECK ("kind" in ('appointment', 'renewal', 'amendment')),
	CONSTRAINT "employment_contracts_status_chk" CHECK ("status" in ('draft', 'active', 'expired', 'terminated'))
);
--> statement-breakpoint
ALTER TABLE "employment_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_applicants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"opening_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"cnic" text,
	"gender" text,
	"highest_qualification" text,
	"experience_years" numeric(4,1),
	"expected_salary" bigint,
	"cv_file_id" uuid,
	"source" text DEFAULT 'walk_in' NOT NULL,
	"stage" text DEFAULT 'applied' NOT NULL,
	"rating" integer,
	"note" text,
	"rejected_reason" text,
	"staff_id" uuid,
	CONSTRAINT "job_applicants_gender_chk" CHECK ("gender" in ('male', 'female', 'other')),
	CONSTRAINT "job_applicants_source_chk" CHECK ("source" in ('website', 'walk_in', 'referral', 'job_portal', 'newspaper', 'other')),
	CONSTRAINT "job_applicants_stage_chk" CHECK ("stage" in ('applied', 'shortlisted', 'interview', 'demo_lesson', 'offered', 'hired', 'rejected', 'withdrawn')),
	CONSTRAINT "job_applicants_expected_salary_min" CHECK ("expected_salary" >= 0),
	CONSTRAINT "job_applicants_rating_range" CHECK ("rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "job_applicants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"designation_id" uuid NOT NULL,
	"department_id" uuid,
	"branch_id" uuid NOT NULL,
	"positions" integer DEFAULT 1 NOT NULL,
	"employment_type" text NOT NULL,
	"description" text,
	"requirements" text,
	"salary_min" bigint,
	"salary_max" bigint,
	"opens_on" date NOT NULL,
	"closes_on" date,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "job_openings_status_chk" CHECK ("status" in ('draft', 'open', 'on_hold', 'filled', 'closed')),
	CONSTRAINT "job_openings_positions_min" CHECK ("positions" >= 1),
	CONSTRAINT "job_openings_salary_min_min" CHECK ("salary_min" >= 0),
	CONSTRAINT "job_openings_salary_max_min" CHECK ("salary_max" >= 0),
	CONSTRAINT "job_openings_salary_max_from" CHECK ("salary_max" >= "salary_min"),
	CONSTRAINT "job_openings_closes_on_from" CHECK ("closes_on" >= "opens_on")
);
--> statement-breakpoint
ALTER TABLE "job_openings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"employee_no" text NOT NULL,
	"full_name" text NOT NULL,
	"full_name_ur" text,
	"father_or_husband_name" text,
	"gender" text NOT NULL,
	"photo_file_id" uuid,
	"designation_id" uuid NOT NULL,
	"department_id" uuid,
	"home_branch_id" uuid NOT NULL,
	"wing_id" uuid,
	"reports_to_staff_id" uuid,
	"staff_type" text NOT NULL,
	"employment_type" text NOT NULL,
	"joined_on" date NOT NULL,
	"probation_ends_on" date,
	"confirmed_on" date,
	"contract_ends_on" date,
	"last_working_day" date,
	"status" text DEFAULT 'active' NOT NULL,
	"work_phone" text,
	"work_email" text,
	"shift_id" uuid,
	"work_schedule_id" uuid,
	"teachable_subject_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"max_lessons_per_week" integer,
	"custom" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "staff_gender_chk" CHECK ("gender" in ('male', 'female', 'other')),
	CONSTRAINT "staff_staff_type_chk" CHECK ("staff_type" in ('teaching', 'non_teaching')),
	CONSTRAINT "staff_employment_type_chk" CHECK ("employment_type" in ('permanent', 'probation', 'contract', 'part_time', 'visiting', 'daily_wage')),
	CONSTRAINT "staff_status_chk" CHECK ("status" in ('active', 'on_leave', 'suspended', 'notice', 'left')),
	CONSTRAINT "staff_reports_to_staff_id_not_self" CHECK ("reports_to_staff_id" <> "id"),
	CONSTRAINT "staff_probation_ends_on_needed" CHECK ("employment_type" <> 'probation' or "probation_ends_on" is not null),
	CONSTRAINT "staff_contract_ends_on_needed" CHECK ("employment_type" <> 'contract' or "contract_ends_on" is not null)
);
--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_title" text NOT NULL,
	"account_no" text NOT NULL,
	"iban" text,
	"is_primary" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "staff_bank_accounts_status_chk" CHECK ("status" in ('active', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "staff_bank_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"changes" jsonb NOT NULL,
	"file_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	CONSTRAINT "staff_change_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "staff_change_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text,
	"file_id" uuid NOT NULL,
	"issued_on" date,
	"expires_on" date,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	CONSTRAINT "staff_documents_kind_chk" CHECK ("kind" in ('cnic', 'photo', 'degree', 'experience_letter', 'appointment_letter', 'contract', 'police_verification', 'medical_fitness', 'reference', 'other'))
);
--> statement-breakpoint
ALTER TABLE "staff_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_exits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"notice_date" date NOT NULL,
	"last_working_day" date NOT NULL,
	"reason" text,
	"clearance" jsonb DEFAULT '[]' NOT NULL,
	"exit_interview" text,
	"rehire_eligible" boolean,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	CONSTRAINT "staff_exits_kind_chk" CHECK ("kind" in ('resignation', 'termination', 'contract_end', 'retirement', 'death', 'absconded')),
	CONSTRAINT "staff_exits_status_chk" CHECK ("status" in ('pending', 'clearance', 'settled', 'closed', 'withdrawn')),
	CONSTRAINT "staff_exits_last_working_day_from" CHECK ("last_working_day" >= "notice_date")
);
--> statement-breakpoint
ALTER TABLE "staff_exits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"employer" text NOT NULL,
	"role" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date,
	"reason_for_leaving" text,
	"reference_name" text,
	"reference_phone" text,
	CONSTRAINT "staff_experience_to_date_from" CHECK ("to_date" >= "from_date")
);
--> statement-breakpoint
ALTER TABLE "staff_experience" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"effective_on" date NOT NULL,
	"from_value" jsonb,
	"to_value" jsonb,
	"order_no" text,
	"reason" text,
	"approval_request_id" uuid,
	CONSTRAINT "staff_movements_kind_chk" CHECK ("kind" in ('joined', 'confirmed', 'transfer', 'promotion', 'redesignation', 'department_change', 'status_change', 'rejoined', 'left'))
);
--> statement-breakpoint
ALTER TABLE "staff_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_private" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"cnic" text NOT NULL,
	"cnic_expires_on" date,
	"date_of_birth" date NOT NULL,
	"marital_status" text,
	"religion" text,
	"blood_group" text,
	"personal_phone" text NOT NULL,
	"personal_email" text,
	"address" text,
	"city" text,
	"emergency_name" text,
	"emergency_phone" text,
	"emergency_relation" text,
	"eobi_no" text,
	"social_security_no" text,
	"previous_income_this_tax_year" bigint DEFAULT 0 NOT NULL,
	"previous_tax_this_tax_year" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "staff_private_marital_status_chk" CHECK ("marital_status" in ('single', 'married', 'widowed', 'divorced')),
	CONSTRAINT "staff_private_previous_income_this_tax_year_min" CHECK ("previous_income_this_tax_year" >= 0),
	CONSTRAINT "staff_private_previous_tax_this_tax_year_min" CHECK ("previous_tax_this_tax_year" >= 0)
);
--> statement-breakpoint
ALTER TABLE "staff_private" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"level" text NOT NULL,
	"title" text NOT NULL,
	"institution" text,
	"year" integer,
	"result" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "staff_qualifications_level_chk" CHECK ("level" in ('matric', 'intermediate', 'bachelors', 'masters', 'mphil', 'phd', 'b_ed', 'm_ed', 'diploma', 'certificate', 'hifz', 'dars_e_nizami', 'other'))
);
--> statement-breakpoint
ALTER TABLE "staff_qualifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "branches_principal_staff_id_fk_idx" ON "branches" ("principal_staff_id") WHERE "principal_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "branches_board_id_fk_idx" ON "branches" ("board_id") WHERE "board_id" is not null;--> statement-breakpoint
CREATE INDEX "wings_head_staff_id_fk_idx" ON "wings" ("head_staff_id") WHERE "head_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "memberships_staff_id_fk_idx" ON "memberships" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "memberships_guardian_id_fk_idx" ON "memberships" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "memberships_student_id_fk_idx" ON "memberships" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_name_uq" ON "academic_years" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_active_uq" ON "academic_years" ("org_id") WHERE "status" = 'active' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "academic_years_closed_by_fk_idx" ON "academic_years" ("closed_by") WHERE "closed_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "boards_key_uq" ON "boards" ("key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "grade_bands_scheme_grade_uq" ON "grade_bands" ("scheme_id","grade") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "grading_schemes_name_uq" ON "grading_schemes" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "grading_schemes_board_id_fk_idx" ON "grading_schemes" ("board_id") WHERE "board_id" is not null;--> statement-breakpoint
CREATE INDEX "grading_schemes_supersedes_id_fk_idx" ON "grading_schemes" ("supersedes_id") WHERE "supersedes_id" is not null;--> statement-breakpoint
CREATE INDEX "holidays_start_date_end_date_idx" ON "holidays" ("org_id","start_date","end_date");--> statement-breakpoint
CREATE INDEX "holidays_branch_id_fk_idx" ON "holidays" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_branch_name_uq" ON "shifts" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "terms_academic_year_sequence_uq" ON "terms" ("academic_year_id","sequence") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_academic_year_uq" ON "enrollments" ("org_id","student_id","academic_year_id") WHERE "deleted_at" is null and "status" not in ('left', 'transferred');--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_section_roll_no_uq" ON "enrollments" ("section_id","roll_no") WHERE "deleted_at" is null and "status" = 'active';--> statement-breakpoint
CREATE INDEX "enrollments_section_status_idx" ON "enrollments" ("org_id","section_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_branch_id_fk_idx" ON "enrollments" ("branch_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_id_fk_idx" ON "enrollments" ("student_id");--> statement-breakpoint
CREATE INDEX "enrollments_academic_year_id_fk_idx" ON "enrollments" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "enrollments_grade_id_fk_idx" ON "enrollments" ("grade_id");--> statement-breakpoint
CREATE INDEX "enrollments_subject_group_id_fk_idx" ON "enrollments" ("subject_group_id") WHERE "subject_group_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "families_family_code_uq" ON "families" ("org_id","family_code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "families_primary_guardian_id_fk_idx" ON "families" ("primary_guardian_id") WHERE "primary_guardian_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_cnic_uq" ON "guardians" ("org_id","cnic") WHERE "deleted_at" is null and "cnic" is not null;--> statement-breakpoint
CREATE INDEX "guardians_phone_idx" ON "guardians" ("org_id","phone");--> statement-breakpoint
CREATE INDEX "guardians_full_name_trgm" ON "guardians" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "guardians_family_id_fk_idx" ON "guardians" ("family_id");--> statement-breakpoint
CREATE INDEX "guardians_photo_file_id_fk_idx" ON "guardians" ("photo_file_id") WHERE "photo_file_id" is not null;--> statement-breakpoint
CREATE INDEX "profile_change_requests_student_id_fk_idx" ON "profile_change_requests" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "profile_change_requests_guardian_id_fk_idx" ON "profile_change_requests" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "profile_change_requests_decided_by_fk_idx" ON "profile_change_requests" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "promotion_batches_branch_id_fk_idx" ON "promotion_batches" ("branch_id");--> statement-breakpoint
CREATE INDEX "promotion_batches_from_academic_year_id_fk_idx" ON "promotion_batches" ("from_academic_year_id");--> statement-breakpoint
CREATE INDEX "promotion_batches_to_academic_year_id_fk_idx" ON "promotion_batches" ("to_academic_year_id");--> statement-breakpoint
CREATE INDEX "promotion_batches_grade_id_fk_idx" ON "promotion_batches" ("grade_id");--> statement-breakpoint
CREATE INDEX "promotion_batches_section_id_fk_idx" ON "promotion_batches" ("section_id") WHERE "section_id" is not null;--> statement-breakpoint
CREATE INDEX "promotion_batches_committed_by_fk_idx" ON "promotion_batches" ("committed_by") WHERE "committed_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_items_batch_student_uq" ON "promotion_items" ("batch_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "promotion_items_branch_id_fk_idx" ON "promotion_items" ("branch_id");--> statement-breakpoint
CREATE INDEX "promotion_items_student_id_fk_idx" ON "promotion_items" ("student_id");--> statement-breakpoint
CREATE INDEX "promotion_items_enrollment_id_fk_idx" ON "promotion_items" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "promotion_items_to_grade_id_fk_idx" ON "promotion_items" ("to_grade_id") WHERE "to_grade_id" is not null;--> statement-breakpoint
CREATE INDEX "promotion_items_to_section_id_fk_idx" ON "promotion_items" ("to_section_id") WHERE "to_section_id" is not null;--> statement-breakpoint
CREATE INDEX "promotion_items_new_enrollment_id_fk_idx" ON "promotion_items" ("new_enrollment_id") WHERE "new_enrollment_id" is not null;--> statement-breakpoint
CREATE INDEX "section_changes_branch_id_fk_idx" ON "section_changes" ("branch_id");--> statement-breakpoint
CREATE INDEX "section_changes_enrollment_id_fk_idx" ON "section_changes" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "section_changes_from_section_id_fk_idx" ON "section_changes" ("from_section_id");--> statement-breakpoint
CREATE INDEX "section_changes_to_section_id_fk_idx" ON "section_changes" ("to_section_id");--> statement-breakpoint
CREATE INDEX "student_documents_branch_id_fk_idx" ON "student_documents" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_documents_student_id_fk_idx" ON "student_documents" ("student_id");--> statement-breakpoint
CREATE INDEX "student_documents_file_id_fk_idx" ON "student_documents" ("file_id");--> statement-breakpoint
CREATE INDEX "student_documents_verified_by_fk_idx" ON "student_documents" ("verified_by") WHERE "verified_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardians_student_guardian_uq" ON "student_guardians" ("student_id","guardian_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "student_guardians_primary_uq" ON "student_guardians" ("student_id") WHERE "is_primary" and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "student_guardians_guardian_id_fk_idx" ON "student_guardians" ("guardian_id");--> statement-breakpoint
CREATE INDEX "student_status_history_branch_id_fk_idx" ON "student_status_history" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_status_history_student_id_fk_idx" ON "student_status_history" ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_withdrawals_student_uq" ON "student_withdrawals" ("org_id","student_id") WHERE "deleted_at" is null and "status" in ('requested', 'clearance', 'approved');--> statement-breakpoint
CREATE INDEX "student_withdrawals_branch_id_fk_idx" ON "student_withdrawals" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_withdrawals_student_id_fk_idx" ON "student_withdrawals" ("student_id");--> statement-breakpoint
CREATE INDEX "student_withdrawals_approved_by_fk_idx" ON "student_withdrawals" ("approved_by") WHERE "approved_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "students_admission_no_uq" ON "students" ("org_id","admission_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "students_b_form_no_uq" ON "students" ("org_id","b_form_no") WHERE "deleted_at" is null and "b_form_no" is not null;--> statement-breakpoint
CREATE INDEX "students_branch_status_idx" ON "students" ("org_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "students_family_idx" ON "students" ("org_id","family_id");--> statement-breakpoint
CREATE INDEX "students_full_name_trgm" ON "students" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "students_father_name_trgm" ON "students" USING gin ("father_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "students_admission_no_trgm" ON "students" USING gin ("admission_no" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "students_branch_id_fk_idx" ON "students" ("branch_id");--> statement-breakpoint
CREATE INDEX "students_family_id_fk_idx" ON "students" ("family_id");--> statement-breakpoint
CREATE INDEX "students_photo_file_id_fk_idx" ON "students" ("photo_file_id") WHERE "photo_file_id" is not null;--> statement-breakpoint
CREATE INDEX "students_admission_grade_id_fk_idx" ON "students" ("admission_grade_id");--> statement-breakpoint
CREATE INDEX "students_staff_parent_id_fk_idx" ON "students" ("staff_parent_id") WHERE "staff_parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_requests_student_uq" ON "transfer_requests" ("org_id","student_id") WHERE "deleted_at" is null and "status" in ('requested', 'approved');--> statement-breakpoint
CREATE INDEX "transfer_requests_student_id_fk_idx" ON "transfer_requests" ("student_id");--> statement-breakpoint
CREATE INDEX "transfer_requests_from_branch_id_fk_idx" ON "transfer_requests" ("from_branch_id");--> statement-breakpoint
CREATE INDEX "transfer_requests_to_branch_id_fk_idx" ON "transfer_requests" ("to_branch_id");--> statement-breakpoint
CREATE INDEX "transfer_requests_to_section_id_fk_idx" ON "transfer_requests" ("to_section_id") WHERE "to_section_id" is not null;--> statement-breakpoint
CREATE INDEX "transfer_requests_decided_by_fk_idx" ON "transfer_requests" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "grade_subjects_academic_year_grade_subject_subject_group_uq" ON "grade_subjects" ("academic_year_id","grade_id","subject_id",coalesce("subject_group_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "grade_subjects_grade_id_fk_idx" ON "grade_subjects" ("grade_id");--> statement-breakpoint
CREATE INDEX "grade_subjects_subject_id_fk_idx" ON "grade_subjects" ("subject_id");--> statement-breakpoint
CREATE INDEX "grade_subjects_subject_group_id_fk_idx" ON "grade_subjects" ("subject_group_id") WHERE "subject_group_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "grades_level_uq" ON "grades" ("org_id","level") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "grades_next_grade_id_fk_idx" ON "grades" ("next_grade_id") WHERE "next_grade_id" is not null;--> statement-breakpoint
CREATE INDEX "grades_grading_scheme_id_fk_idx" ON "grades" ("grading_scheme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "section_subjects_section_grade_subject_uq" ON "section_subjects" ("section_id","grade_subject_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "section_subjects_teacher_idx" ON "section_subjects" ("org_id","teacher_id");--> statement-breakpoint
CREATE INDEX "section_subjects_branch_id_fk_idx" ON "section_subjects" ("branch_id");--> statement-breakpoint
CREATE INDEX "section_subjects_grade_subject_id_fk_idx" ON "section_subjects" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "section_subjects_teacher_id_fk_idx" ON "section_subjects" ("teacher_id") WHERE "teacher_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sections_branch_academic_year_grade_name_uq" ON "sections" ("branch_id","academic_year_id","grade_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "sections_branch_academic_year_grade_idx" ON "sections" ("org_id","branch_id","academic_year_id","grade_id");--> statement-breakpoint
CREATE INDEX "sections_academic_year_id_fk_idx" ON "sections" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "sections_grade_id_fk_idx" ON "sections" ("grade_id");--> statement-breakpoint
CREATE INDEX "sections_class_teacher_id_fk_idx" ON "sections" ("class_teacher_id") WHERE "class_teacher_id" is not null;--> statement-breakpoint
CREATE INDEX "sections_room_id_fk_idx" ON "sections" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "sections_shift_id_fk_idx" ON "sections" ("shift_id") WHERE "shift_id" is not null;--> statement-breakpoint
CREATE INDEX "sections_wing_id_fk_idx" ON "sections" ("wing_id") WHERE "wing_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "student_subject_overrides_enrollment_grade_subject_uq" ON "student_subject_overrides" ("enrollment_id","grade_subject_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "student_subject_overrides_branch_id_fk_idx" ON "student_subject_overrides" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_subject_overrides_student_id_fk_idx" ON "student_subject_overrides" ("student_id");--> statement-breakpoint
CREATE INDEX "student_subject_overrides_grade_subject_id_fk_idx" ON "student_subject_overrides" ("grade_subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subject_groups_key_uq" ON "subject_groups" ("org_id","key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_code_uq" ON "subjects" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "subjects_alternative_of_id_fk_idx" ON "subjects" ("alternative_of_id") WHERE "alternative_of_id" is not null;--> statement-breakpoint
CREATE INDEX "applicant_interviews_applicant_id_fk_idx" ON "applicant_interviews" ("applicant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_uq" ON "departments" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_uq" ON "departments" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "departments_head_staff_id_fk_idx" ON "departments" ("head_staff_id") WHERE "head_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "departments_parent_id_fk_idx" ON "departments" ("parent_id") WHERE "parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "designations_name_uq" ON "designations" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "employment_contracts_staff_id_fk_idx" ON "employment_contracts" ("staff_id");--> statement-breakpoint
CREATE INDEX "employment_contracts_document_id_fk_idx" ON "employment_contracts" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "employment_contracts_signed_file_id_fk_idx" ON "employment_contracts" ("signed_file_id") WHERE "signed_file_id" is not null;--> statement-breakpoint
CREATE INDEX "job_applicants_opening_stage_idx" ON "job_applicants" ("org_id","opening_id","stage");--> statement-breakpoint
CREATE INDEX "job_applicants_opening_id_fk_idx" ON "job_applicants" ("opening_id");--> statement-breakpoint
CREATE INDEX "job_applicants_cv_file_id_fk_idx" ON "job_applicants" ("cv_file_id") WHERE "cv_file_id" is not null;--> statement-breakpoint
CREATE INDEX "job_applicants_staff_id_fk_idx" ON "job_applicants" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "job_openings_designation_id_fk_idx" ON "job_openings" ("designation_id");--> statement-breakpoint
CREATE INDEX "job_openings_department_id_fk_idx" ON "job_openings" ("department_id") WHERE "department_id" is not null;--> statement-breakpoint
CREATE INDEX "job_openings_branch_id_fk_idx" ON "job_openings" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_employee_no_uq" ON "staff" ("org_id","employee_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_home_branch_status_idx" ON "staff" ("org_id","home_branch_id","status");--> statement-breakpoint
CREATE INDEX "staff_full_name_trgm" ON "staff" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "staff_employee_no_trgm" ON "staff" USING gin ("employee_no" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "staff_photo_file_id_fk_idx" ON "staff" ("photo_file_id") WHERE "photo_file_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_designation_id_fk_idx" ON "staff" ("designation_id");--> statement-breakpoint
CREATE INDEX "staff_department_id_fk_idx" ON "staff" ("department_id") WHERE "department_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_home_branch_id_fk_idx" ON "staff" ("home_branch_id");--> statement-breakpoint
CREATE INDEX "staff_wing_id_fk_idx" ON "staff" ("wing_id") WHERE "wing_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_reports_to_staff_id_fk_idx" ON "staff" ("reports_to_staff_id") WHERE "reports_to_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_shift_id_fk_idx" ON "staff" ("shift_id") WHERE "shift_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_bank_accounts_primary_uq" ON "staff_bank_accounts" ("staff_id") WHERE "is_primary" and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_change_requests_staff_id_fk_idx" ON "staff_change_requests" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_change_requests_file_id_fk_idx" ON "staff_change_requests" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_change_requests_reviewed_by_fk_idx" ON "staff_change_requests" ("reviewed_by") WHERE "reviewed_by" is not null;--> statement-breakpoint
CREATE INDEX "staff_documents_staff_id_fk_idx" ON "staff_documents" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_documents_file_id_fk_idx" ON "staff_documents" ("file_id");--> statement-breakpoint
CREATE INDEX "staff_documents_verified_by_fk_idx" ON "staff_documents" ("verified_by") WHERE "verified_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_exits_open_uq" ON "staff_exits" ("staff_id") WHERE "status" not in ('closed', 'withdrawn') and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_exits_approval_request_id_fk_idx" ON "staff_exits" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_experience_staff_id_fk_idx" ON "staff_experience" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_movements_staff_effective_on_idx" ON "staff_movements" ("org_id","staff_id","effective_on");--> statement-breakpoint
CREATE INDEX "staff_movements_staff_id_fk_idx" ON "staff_movements" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_movements_approval_request_id_fk_idx" ON "staff_movements" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_private_staff_uq" ON "staff_private" ("staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_qualifications_staff_id_fk_idx" ON "staff_qualifications" ("staff_id");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_principal_staff_id_staff_id_fkey" FOREIGN KEY ("principal_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_board_id_boards_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id");--> statement-breakpoint
ALTER TABLE "wings" ADD CONSTRAINT "wings_head_staff_id_staff_id_fkey" FOREIGN KEY ("head_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_closed_by_profiles_id_fkey" FOREIGN KEY ("closed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "grade_bands" ADD CONSTRAINT "grade_bands_scheme_id_grading_schemes_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "grading_schemes"("id");--> statement-breakpoint
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_board_id_boards_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id");--> statement-breakpoint
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_supersedes_id_grading_schemes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "grading_schemes"("id");--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subject_group_id_subject_groups_id_fkey" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id");--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_primary_guardian_id_guardians_id_fkey" FOREIGN KEY ("primary_guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_photo_file_id_files_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_from_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("from_academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_to_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("to_academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_committed_by_profiles_id_fkey" FOREIGN KEY ("committed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_batch_id_promotion_batches_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "promotion_batches"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_to_grade_id_grades_id_fkey" FOREIGN KEY ("to_grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_to_section_id_sections_id_fkey" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "promotion_items" ADD CONSTRAINT "promotion_items_new_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("new_enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "section_changes" ADD CONSTRAINT "section_changes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "section_changes" ADD CONSTRAINT "section_changes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "section_changes" ADD CONSTRAINT "section_changes_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "section_changes" ADD CONSTRAINT "section_changes_from_section_id_sections_id_fkey" FOREIGN KEY ("from_section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "section_changes" ADD CONSTRAINT "section_changes_to_section_id_sections_id_fkey" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_verified_by_profiles_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_status_history" ADD CONSTRAINT "student_status_history_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_withdrawals" ADD CONSTRAINT "student_withdrawals_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_withdrawals" ADD CONSTRAINT "student_withdrawals_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_withdrawals" ADD CONSTRAINT "student_withdrawals_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_withdrawals" ADD CONSTRAINT "student_withdrawals_approved_by_profiles_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_photo_file_id_files_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_admission_grade_id_grades_id_fkey" FOREIGN KEY ("admission_grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_staff_parent_id_staff_id_fkey" FOREIGN KEY ("staff_parent_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_from_branch_id_branches_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_to_branch_id_branches_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_to_section_id_sections_id_fkey" FOREIGN KEY ("to_section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "grade_subjects" ADD CONSTRAINT "grade_subjects_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "grade_subjects" ADD CONSTRAINT "grade_subjects_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "grade_subjects" ADD CONSTRAINT "grade_subjects_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "grade_subjects" ADD CONSTRAINT "grade_subjects_subject_id_subjects_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id");--> statement-breakpoint
ALTER TABLE "grade_subjects" ADD CONSTRAINT "grade_subjects_subject_group_id_subject_groups_id_fkey" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id");--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_next_grade_id_grades_id_fkey" FOREIGN KEY ("next_grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_grading_scheme_id_grading_schemes_id_fkey" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id");--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "section_subjects" ADD CONSTRAINT "section_subjects_teacher_id_staff_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_teacher_id_staff_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id");--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_wing_id_wings_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wings"("id");--> statement-breakpoint
ALTER TABLE "student_subject_overrides" ADD CONSTRAINT "student_subject_overrides_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_subject_overrides" ADD CONSTRAINT "student_subject_overrides_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_subject_overrides" ADD CONSTRAINT "student_subject_overrides_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "student_subject_overrides" ADD CONSTRAINT "student_subject_overrides_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_subject_overrides" ADD CONSTRAINT "student_subject_overrides_grade_subject_id_grade_subje_fa2eb797" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "subject_groups" ADD CONSTRAINT "subject_groups_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_alternative_of_id_subjects_id_fkey" FOREIGN KEY ("alternative_of_id") REFERENCES "subjects"("id");--> statement-breakpoint
ALTER TABLE "applicant_interviews" ADD CONSTRAINT "applicant_interviews_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "applicant_interviews" ADD CONSTRAINT "applicant_interviews_applicant_id_job_applicants_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "job_applicants"("id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_staff_id_staff_id_fkey" FOREIGN KEY ("head_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id");--> statement-breakpoint
ALTER TABLE "designations" ADD CONSTRAINT "designations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_signed_file_id_files_id_fkey" FOREIGN KEY ("signed_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_opening_id_job_openings_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "job_openings"("id");--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_cv_file_id_files_id_fkey" FOREIGN KEY ("cv_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "job_applicants" ADD CONSTRAINT "job_applicants_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_designation_id_designations_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id");--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id");--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_photo_file_id_files_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_designation_id_designations_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_home_branch_id_branches_id_fkey" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_wing_id_wings_id_fkey" FOREIGN KEY ("wing_id") REFERENCES "wings"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_reports_to_staff_id_staff_id_fkey" FOREIGN KEY ("reports_to_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id");--> statement-breakpoint
ALTER TABLE "staff_bank_accounts" ADD CONSTRAINT "staff_bank_accounts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_bank_accounts" ADD CONSTRAINT "staff_bank_accounts_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_change_requests" ADD CONSTRAINT "staff_change_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_change_requests" ADD CONSTRAINT "staff_change_requests_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_change_requests" ADD CONSTRAINT "staff_change_requests_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "staff_change_requests" ADD CONSTRAINT "staff_change_requests_reviewed_by_profiles_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "staff_documents" ADD CONSTRAINT "staff_documents_verified_by_profiles_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "staff_exits" ADD CONSTRAINT "staff_exits_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_exits" ADD CONSTRAINT "staff_exits_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_exits" ADD CONSTRAINT "staff_exits_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "staff_experience" ADD CONSTRAINT "staff_experience_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_experience" ADD CONSTRAINT "staff_experience_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_movements" ADD CONSTRAINT "staff_movements_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_movements" ADD CONSTRAINT "staff_movements_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_movements" ADD CONSTRAINT "staff_movements_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "staff_private" ADD CONSTRAINT "staff_private_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_private" ADD CONSTRAINT "staff_private_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_qualifications" ADD CONSTRAINT "staff_qualifications_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_qualifications" ADD CONSTRAINT "staff_qualifications_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
CREATE POLICY "academic_years_staff" ON "academic_years" AS PERMISSIVE FOR ALL TO "authenticated" USING ("academic_years"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("academic_years"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "academic_years_member_read" ON "academic_years" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("academic_years"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "boards_read" ON "boards" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "grade_bands_staff" ON "grade_bands" AS PERMISSIVE FOR ALL TO "authenticated" USING ("grade_bands"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("grade_bands"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "grading_schemes_staff" ON "grading_schemes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("grading_schemes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("grading_schemes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "holidays_staff" ON "holidays" AS PERMISSIVE FOR ALL TO "authenticated" USING ("holidays"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("holidays"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "holidays_member_read" ON "holidays" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("holidays"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "shifts_staff" ON "shifts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shifts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shifts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shifts_member_read" ON "shifts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("shifts"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "shifts_branch" ON "shifts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "shifts"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "shifts"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "terms_staff" ON "terms" AS PERMISSIVE FOR ALL TO "authenticated" USING ("terms"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("terms"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "terms_member_read" ON "terms" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("terms"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "enrollments_staff" ON "enrollments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("enrollments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("enrollments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "enrollments_family_read" ON "enrollments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("enrollments"."org_id" = (select app.org_id()) and "enrollments"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "enrollments_branch" ON "enrollments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "enrollments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "enrollments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "families_staff" ON "families" AS PERMISSIVE FOR ALL TO "authenticated" USING ("families"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("families"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "families_household_read" ON "families" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("families"."org_id" = (select app.org_id()) and "families"."id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "guardians_staff" ON "guardians" AS PERMISSIVE FOR ALL TO "authenticated" USING ("guardians"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("guardians"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "guardians_guardian_read" ON "guardians" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("guardians"."org_id" = (select app.org_id()) and "guardians"."id" = (select app.guardian_id()));--> statement-breakpoint
CREATE POLICY "profile_change_requests_staff" ON "profile_change_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("profile_change_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("profile_change_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "profile_change_requests_family_read" ON "profile_change_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profile_change_requests"."org_id" = (select app.org_id()) and "profile_change_requests"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "profile_change_requests_family_insert" ON "profile_change_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("profile_change_requests"."org_id" = (select app.org_id()) and "profile_change_requests"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "profile_change_requests_guardian_read" ON "profile_change_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profile_change_requests"."org_id" = (select app.org_id()) and "profile_change_requests"."guardian_id" = (select app.guardian_id()));--> statement-breakpoint
CREATE POLICY "profile_change_requests_guardian_insert" ON "profile_change_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("profile_change_requests"."org_id" = (select app.org_id()) and "profile_change_requests"."guardian_id" = (select app.guardian_id()));--> statement-breakpoint
CREATE POLICY "promotion_batches_staff" ON "promotion_batches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("promotion_batches"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("promotion_batches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "promotion_batches_branch" ON "promotion_batches" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "promotion_batches"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "promotion_batches"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "promotion_items_staff" ON "promotion_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("promotion_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("promotion_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "promotion_items_branch" ON "promotion_items" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "promotion_items"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "promotion_items"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "section_changes_staff_read" ON "section_changes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("section_changes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "section_changes_staff_insert" ON "section_changes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("section_changes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "section_changes_branch" ON "section_changes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "section_changes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "section_changes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_documents_staff" ON "student_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_documents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_documents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_documents_family_read" ON "student_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_documents"."org_id" = (select app.org_id()) and "student_documents"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_documents_branch" ON "student_documents" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_documents"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_documents"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_guardians_staff" ON "student_guardians" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_guardians"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_guardians"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_guardians_family_read" ON "student_guardians" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_guardians"."org_id" = (select app.org_id()) and "student_guardians"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_status_history_staff_read" ON "student_status_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_status_history"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_status_history_staff_insert" ON "student_status_history" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("student_status_history"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_status_history_branch" ON "student_status_history" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_status_history"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_status_history"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_withdrawals_staff" ON "student_withdrawals" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_withdrawals"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_withdrawals"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_withdrawals_branch" ON "student_withdrawals" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_withdrawals"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_withdrawals"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "students_staff" ON "students" AS PERMISSIVE FOR ALL TO "authenticated" USING ("students"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("students"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "students_family_read" ON "students" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("students"."org_id" = (select app.org_id()) and "students"."id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "students_branch" ON "students" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "students"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "students"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "transfer_requests_staff" ON "transfer_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("transfer_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("transfer_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "grade_subjects_staff" ON "grade_subjects" AS PERMISSIVE FOR ALL TO "authenticated" USING ("grade_subjects"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("grade_subjects"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "grade_subjects_member_read" ON "grade_subjects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("grade_subjects"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "grades_staff" ON "grades" AS PERMISSIVE FOR ALL TO "authenticated" USING ("grades"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("grades"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "grades_member_read" ON "grades" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("grades"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "section_subjects_staff" ON "section_subjects" AS PERMISSIVE FOR ALL TO "authenticated" USING ("section_subjects"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("section_subjects"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "section_subjects_member_read" ON "section_subjects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("section_subjects"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "section_subjects_branch" ON "section_subjects" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "section_subjects"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "section_subjects"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "sections_staff" ON "sections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("sections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "sections_member_read" ON "sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("sections"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "sections_branch" ON "sections" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "sections"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "sections"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_subject_overrides_staff" ON "student_subject_overrides" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_subject_overrides"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_subject_overrides"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_subject_overrides_family_read" ON "student_subject_overrides" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_subject_overrides"."org_id" = (select app.org_id()) and "student_subject_overrides"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_subject_overrides_branch" ON "student_subject_overrides" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_subject_overrides"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_subject_overrides"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "subject_groups_staff" ON "subject_groups" AS PERMISSIVE FOR ALL TO "authenticated" USING ("subject_groups"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("subject_groups"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "subject_groups_member_read" ON "subject_groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subject_groups"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "subjects_staff" ON "subjects" AS PERMISSIVE FOR ALL TO "authenticated" USING ("subjects"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("subjects"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "subjects_member_read" ON "subjects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subjects"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "applicant_interviews_staff" ON "applicant_interviews" AS PERMISSIVE FOR ALL TO "authenticated" USING ("applicant_interviews"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("applicant_interviews"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "departments_staff" ON "departments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("departments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("departments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "designations_staff" ON "designations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("designations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("designations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "employment_contracts_staff" ON "employment_contracts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("employment_contracts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("employment_contracts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "employment_contracts_cap" ON "employment_contracts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('hr')) or "employment_contracts"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('hr')) or "employment_contracts"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "job_applicants_staff" ON "job_applicants" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_applicants"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("job_applicants"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "job_openings_staff" ON "job_openings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_openings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("job_openings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_staff" ON "staff" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_bank_accounts_staff" ON "staff_bank_accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_bank_accounts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_bank_accounts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_bank_accounts_cap" ON "staff_bank_accounts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_bank_accounts"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_bank_accounts"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "staff_change_requests_staff" ON "staff_change_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_change_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_change_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_change_requests_cap" ON "staff_change_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_change_requests"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_change_requests"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "staff_documents_staff" ON "staff_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_documents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_documents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_documents_cap" ON "staff_documents" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_documents"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_documents"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "staff_exits_staff" ON "staff_exits" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_exits"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_exits"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_experience_staff" ON "staff_experience" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_experience"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_experience"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_experience_cap" ON "staff_experience" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_experience"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_experience"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "staff_movements_staff_read" ON "staff_movements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("staff_movements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_movements_staff_insert" ON "staff_movements" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("staff_movements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_private_staff" ON "staff_private" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_private"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_private"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_private_cap" ON "staff_private" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_private"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('hr')) or "staff_private"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "staff_qualifications_staff" ON "staff_qualifications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_qualifications"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_qualifications"."org_id" = (select app.org_id()) and (select app.is_staff()));

-- Hand-written SQL for Wave 1 (packages/db/src/custom-sql/wave-1.sql)

-- academic_years
alter table academic_years add constraint academic_years_no_overlap exclude using gist (org_id with =, daterange(start_date, end_date, '[]') with &&) where (deleted_at is null);

-- terms
alter table terms add constraint terms_no_overlap exclude using gist (academic_year_id with =, daterange(start_date, end_date, '[]') with &&) where (deleted_at is null);

-- staff
create view staff_directory with (security_barrier = true) as
  select id, org_id, full_name, full_name_ur, gender, photo_file_id, (status <> 'left') as is_active
  from staff
  where deleted_at is null and org_id = (select app.org_id());
revoke all on staff_directory from public, anon, authenticated;
grant select on staff_directory to authenticated;
comment on view staff_directory is 'What every member of an organisation, families included, may know about its staff: a name and a photograph.';

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  wanted text := claims -> 'app_metadata' ->> 'membership_id';
  found_id uuid;
  matches integer;
  m record;
  branches jsonb;
  children jsonb := '[]'::jsonb;
  family uuid;
begin
  -- Claims from an earlier token must not survive a change of membership.
  claims := claims - 'org_id' - 'kind' - 'staff_id' - 'guardian_id' - 'family_id' - 'all_branches'
                   - 'branch_ids' - 'student_ids' - 'caps' - 'membership_id' - 'membership_version';

  select count(*), min(ms.id::text)::uuid
    into matches, found_id
  from public.memberships ms
  join public.orgs o on o.id = ms.org_id
  where ms.user_id = (event ->> 'user_id')::uuid
    and ms.deleted_at is null and ms.status = 'active'
    and o.deleted_at is null and o.status = 'active'
    and (wanted is null or wanted = '' or ms.id::text = wanted);

  if matches = 1 then
    select ms.id, ms.org_id, ms.kind, ms.staff_id, ms.guardian_id, ms.student_id, ms.all_branches, ms.token_version
      into m
    from public.memberships ms
    where ms.id = found_id;

    select coalesce(jsonb_agg(mb.branch_id), '[]'::jsonb)
      into branches
    from public.membership_branches mb
    where mb.membership_id = m.id and mb.deleted_at is null;

    -- A student reaches their own records; a guardian, those of the students they are linked to.
    if m.kind = 'student' and m.student_id is not null then
      select s.family_id into family
      from public.students s
      where s.id = m.student_id and s.org_id = m.org_id and s.deleted_at is null;
      if found then
        children := jsonb_build_array(m.student_id);
      end if;
    elsif m.kind = 'guardian' and m.guardian_id is not null then
      select g.family_id into family
      from public.guardians g
      where g.id = m.guardian_id and g.org_id = m.org_id and g.deleted_at is null;
      if found then
        select coalesce(jsonb_agg(s.id order by s.id), '[]'::jsonb)
          into children
        from public.student_guardians sg
        join public.students s on s.id = sg.student_id
        where sg.guardian_id = m.guardian_id and sg.deleted_at is null
          and s.org_id = m.org_id and s.deleted_at is null;
      end if;
    end if;

    claims := claims || jsonb_build_object(
      'org_id', m.org_id,
      'kind', m.kind,
      'membership_id', m.id,
      'membership_version', m.token_version,
      'all_branches', m.all_branches,
      'branch_ids', branches,
      'student_ids', children,
      'caps', '[]'::jsonb
    );
    if m.staff_id is not null then
      claims := claims || jsonb_build_object('staff_id', m.staff_id);
    end if;
    if m.guardian_id is not null then
      claims := claims || jsonb_build_object('guardian_id', m.guardian_id);
    end if;
    if family is not null then
      claims := claims || jsonb_build_object('family_id', family);
    end if;
  end if;

  return jsonb_set(event, '{claims}', claims);
exception when others then
  return event;
end
$$;
