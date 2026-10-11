CREATE TABLE "bell_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"bell_schedule_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" text NOT NULL,
	"lesson_no" integer,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "bell_periods_kind_chk" CHECK ("kind" in ('lesson', 'break', 'assembly', 'prayer', 'activity')),
	CONSTRAINT "bell_periods_sequence_pos" CHECK ("sequence" > 0),
	CONSTRAINT "bell_periods_lesson_no_pos" CHECK ("lesson_no" > 0),
	CONSTRAINT "bell_periods_lesson_no_kind" CHECK (("kind" = 'lesson') = ("lesson_no" is not null)),
	CONSTRAINT "bell_periods_end_time_after" CHECK ("end_time" > "start_time")
);
--> statement-breakpoint
ALTER TABLE "bell_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bell_schedules" (
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
	"shift_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"weekdays" text[] NOT NULL,
	"lesson_count" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "bell_schedules_status_chk" CHECK ("status" in ('draft', 'active', 'archived')),
	CONSTRAINT "bell_schedules_valid_to_from" CHECK ("valid_to" >= "valid_from"),
	CONSTRAINT "bell_schedules_weekdays_days" CHECK (cardinality("weekdays") >= 1 and "weekdays" <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
	CONSTRAINT "bell_schedules_lesson_count_pos" CHECK ("lesson_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "bell_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"substitution_date" date NOT NULL,
	"timetable_entry_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"lesson_no" integer NOT NULL,
	"absent_teacher_id" uuid NOT NULL,
	"substitute_teacher_id" uuid,
	"reason" text NOT NULL,
	"leave_request_id" uuid,
	"status" text DEFAULT 'planned' NOT NULL,
	"note" text,
	CONSTRAINT "substitutions_reason_chk" CHECK ("reason" in ('leave', 'absent', 'duty', 'training', 'other')),
	CONSTRAINT "substitutions_status_chk" CHECK ("status" in ('planned', 'confirmed', 'cancelled')),
	CONSTRAINT "substitutions_lesson_no_pos" CHECK ("lesson_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "substitutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teacher_availability" (
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
	"weekday" text NOT NULL,
	"lesson_no" integer NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	CONSTRAINT "teacher_availability_weekday_chk" CHECK ("weekday" in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
	CONSTRAINT "teacher_availability_kind_chk" CHECK ("kind" in ('unavailable', 'preferred')),
	CONSTRAINT "teacher_availability_lesson_no_pos" CHECK ("lesson_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "teacher_availability" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "timetable_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"timetable_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"weekday" text NOT NULL,
	"lesson_no" integer NOT NULL,
	"section_subject_id" uuid NOT NULL,
	"teacher_id" uuid,
	"room_id" uuid,
	"note" text,
	CONSTRAINT "timetable_entries_weekday_chk" CHECK ("weekday" in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
	CONSTRAINT "timetable_entries_lesson_no_pos" CHECK ("lesson_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "timetable_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "timetables" (
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
	"shift_id" uuid NOT NULL,
	"name" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"copied_from_id" uuid,
	CONSTRAINT "timetables_status_chk" CHECK ("status" in ('draft', 'published', 'archived')),
	CONSTRAINT "timetables_effective_to_from" CHECK ("effective_to" >= "effective_from")
);
--> statement-breakpoint
ALTER TABLE "timetables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learning_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"unit_id" uuid NOT NULL,
	"code" text,
	"statement" text NOT NULL,
	"statement_ur" text,
	"level" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "learning_outcomes_level_chk" CHECK ("level" in ('remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'))
);
--> statement-breakpoint
ALTER TABLE "learning_outcomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"section_subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"plan_date" date NOT NULL,
	"lesson_no" integer,
	"unit_id" uuid,
	"outcome_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"title" text NOT NULL,
	"objectives" text NOT NULL,
	"activities" jsonb DEFAULT '[]' NOT NULL,
	"resources" text,
	"classwork" text,
	"homework" text,
	"assessment" text,
	"differentiation" text,
	"reflection" text,
	"language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	"drafted_by_ai" boolean DEFAULT false NOT NULL,
	"copied_from_id" uuid,
	CONSTRAINT "lesson_plans_language_chk" CHECK ("language" in ('en', 'ur', 'both')),
	CONSTRAINT "lesson_plans_status_chk" CHECK ("status" in ('draft', 'submitted', 'approved', 'returned', 'taught')),
	CONSTRAINT "lesson_plans_lesson_no_pos" CHECK ("lesson_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "lesson_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scheme_weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"scheme_id" uuid NOT NULL,
	"week_no" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"unit_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"periods_planned" integer DEFAULT 0 NOT NULL,
	"activities" text,
	"assessment" text,
	"note" text,
	CONSTRAINT "scheme_weeks_week_no_pos" CHECK ("week_no" > 0),
	CONSTRAINT "scheme_weeks_end_date_from" CHECK ("end_date" >= "start_date"),
	CONSTRAINT "scheme_weeks_periods_planned_min" CHECK ("periods_planned" >= 0)
);
--> statement-breakpoint
ALTER TABLE "scheme_weeks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schemes_of_work" (
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
	"term_id" uuid NOT NULL,
	"grade_subject_id" uuid NOT NULL,
	"section_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"return_note" text,
	"drafted_by_ai" boolean DEFAULT false NOT NULL,
	CONSTRAINT "schemes_of_work_status_chk" CHECK ("status" in ('draft', 'submitted', 'approved', 'returned', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "schemes_of_work" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "syllabus_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"section_subject_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"started_on" date,
	"completed_on" date,
	"periods_used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "syllabus_progress_status_chk" CHECK ("status" in ('not_started', 'in_progress', 'completed')),
	CONSTRAINT "syllabus_progress_completed_on_from" CHECK ("completed_on" >= "started_on"),
	CONSTRAINT "syllabus_progress_periods_used_min" CHECK ("periods_used" >= 0)
);
--> statement-breakpoint
ALTER TABLE "syllabus_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "syllabus_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"grade_subject_id" uuid NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"code" text,
	"title" text NOT NULL,
	"title_ur" text,
	"description" text,
	"estimated_periods" integer DEFAULT 0 NOT NULL,
	"sort_order" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"ai_confidence" numeric(4,2),
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "syllabus_units_kind_chk" CHECK ("kind" in ('unit', 'chapter', 'topic')),
	CONSTRAINT "syllabus_units_source_chk" CHECK ("source" in ('manual', 'import', 'ai')),
	CONSTRAINT "syllabus_units_status_chk" CHECK ("status" in ('draft', 'active')),
	CONSTRAINT "syllabus_units_estimated_periods_min" CHECK ("estimated_periods" >= 0),
	CONSTRAINT "syllabus_units_ai_confidence_range" CHECK ("ai_confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "syllabus_units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decision_note" text,
	CONSTRAINT "attendance_corrections_to_status_chk" CHECK ("to_status" in ('present', 'absent', 'late', 'leave', 'half_day')),
	CONSTRAINT "attendance_corrections_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "attendance_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"status" text NOT NULL,
	"minutes_late" integer,
	"note" text,
	"marked_at" timestamp with time zone NOT NULL,
	"marked_by" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	CONSTRAINT "attendance_records_status_chk" CHECK ("status" in ('present', 'absent', 'late', 'leave', 'half_day')),
	CONSTRAINT "attendance_records_source_chk" CHECK ("source" in ('manual', 'biometric', 'qr', 'import', 'leave_request', 'gate_pass')),
	CONSTRAINT "attendance_records_minutes_late_min" CHECK ("minutes_late" >= 0)
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
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
	"session_date" date NOT NULL,
	"lesson_no" integer NOT NULL,
	"section_subject_id" uuid,
	"taken_by" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"submitted_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "attendance_sessions_status_chk" CHECK ("status" in ('draft', 'submitted', 'locked', 'cancelled')),
	CONSTRAINT "attendance_sessions_source_chk" CHECK ("source" in ('manual', 'biometric', 'qr', 'import')),
	CONSTRAINT "attendance_sessions_lesson_no_min" CHECK ("lesson_no" >= 0)
);
--> statement-breakpoint
ALTER TABLE "attendance_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_leave_requests" (
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
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"file_id" uuid,
	"requested_via" text DEFAULT 'portal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	CONSTRAINT "student_leave_requests_reason_chk" CHECK ("reason" in ('sick', 'family', 'travel', 'religious', 'other')),
	CONSTRAINT "student_leave_requests_requested_via_chk" CHECK ("requested_via" in ('portal', 'staff')),
	CONSTRAINT "student_leave_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "student_leave_requests_to_date_from" CHECK ("to_date" >= "from_date"),
	CONSTRAINT "student_leave_requests_to_date_span" CHECK ("to_date" <= "from_date" + 30)
);
--> statement-breakpoint
ALTER TABLE "student_leave_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "diary_acknowledgements" (
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
	"entry_date" date NOT NULL,
	"student_id" uuid NOT NULL,
	"acknowledged_by" uuid NOT NULL,
	"acknowledged_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_acknowledgements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "diary_entries" (
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
	"entry_date" date NOT NULL,
	"section_subject_id" uuid,
	"body" text NOT NULL,
	"posted_by" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "diary_entries_status_chk" CHECK ("status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "homework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"section_subject_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"assigned_on" date NOT NULL,
	"due_date" date NOT NULL,
	"submission" text DEFAULT 'in_notebook' NOT NULL,
	"max_marks" numeric(6,2),
	"unit_id" uuid,
	"publish_at" timestamp with time zone,
	"allow_late" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "homework_submission_chk" CHECK ("submission" in ('in_notebook', 'online_text', 'online_file')),
	CONSTRAINT "homework_status_chk" CHECK ("status" in ('draft', 'published', 'closed')),
	CONSTRAINT "homework_due_date_from" CHECK ("due_date" >= "assigned_on"),
	CONSTRAINT "homework_max_marks_pos" CHECK ("max_marks" > 0)
);
--> statement-breakpoint
ALTER TABLE "homework" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"homework_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"answer_text" text,
	"submitted_at" timestamp with time zone,
	"checked_by" uuid,
	"checked_at" timestamp with time zone,
	"marks" numeric(6,2),
	"remark" text,
	CONSTRAINT "homework_submissions_status_chk" CHECK ("status" in ('pending', 'submitted', 'late', 'checked', 'returned', 'missing', 'excused')),
	CONSTRAINT "homework_submissions_marks_min" CHECK ("marks" >= 0)
);
--> statement-breakpoint
ALTER TABLE "homework_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learning_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"grade_subject_id" uuid NOT NULL,
	"unit_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"url" text,
	"body" text,
	"file_id" uuid,
	"audience" text DEFAULT 'students' NOT NULL,
	"section_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "learning_resources_kind_chk" CHECK ("kind" in ('file', 'link', 'video', 'note')),
	CONSTRAINT "learning_resources_audience_chk" CHECK ("audience" in ('teachers', 'students')),
	CONSTRAINT "learning_resources_status_chk" CHECK ("status" in ('draft', 'published', 'archived')),
	CONSTRAINT "learning_resources_url_needed" CHECK ("kind" not in ('link', 'video') or "url" is not null),
	CONSTRAINT "learning_resources_url_https" CHECK ("url" like 'https://%'),
	CONSTRAINT "learning_resources_body_needed" CHECK ("kind" <> 'note' or "body" is not null),
	CONSTRAINT "learning_resources_file_id_needed" CHECK ("kind" <> 'file' or "file_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "learning_resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "live_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"section_subject_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"platform" text NOT NULL,
	"join_url" text NOT NULL,
	"recording_url" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	CONSTRAINT "live_classes_platform_chk" CHECK ("platform" in ('zoom', 'meet', 'teams', 'other')),
	CONSTRAINT "live_classes_status_chk" CHECK ("status" in ('scheduled', 'cancelled', 'completed')),
	CONSTRAINT "live_classes_ends_at_after" CHECK ("ends_at" > "starts_at"),
	CONSTRAINT "live_classes_join_url_https" CHECK ("join_url" like 'https://%')
);
--> statement-breakpoint
ALTER TABLE "live_classes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"quiz_question_id" uuid NOT NULL,
	"answer" jsonb,
	"is_correct" boolean,
	"marks_awarded" numeric(5,2),
	"graded_by" uuid
);
--> statement-breakpoint
ALTER TABLE "quiz_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"question_order" uuid[] NOT NULL,
	"score" numeric(6,2),
	"max_score" numeric(6,2) NOT NULL,
	CONSTRAINT "quiz_attempts_status_chk" CHECK ("status" in ('in_progress', 'submitted', 'auto_submitted', 'graded')),
	CONSTRAINT "quiz_attempts_attempt_no_pos" CHECK ("attempt_no" > 0)
);
--> statement-breakpoint
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question_id" uuid,
	"sort_order" integer NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"text_ur" text,
	"options" jsonb DEFAULT '[]' NOT NULL,
	"correct" jsonb NOT NULL,
	"marks" numeric(5,2) NOT NULL,
	CONSTRAINT "quiz_questions_type_chk" CHECK ("type" in ('mcq', 'true_false', 'fill_blank', 'short')),
	CONSTRAINT "quiz_questions_marks_pos" CHECK ("marks" > 0)
);
--> statement-breakpoint
ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quizzes" (
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
	"section_ids" uuid[] NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"unit_id" uuid,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"attempts_allowed" integer DEFAULT 1 NOT NULL,
	"shuffle_questions" boolean DEFAULT true NOT NULL,
	"shuffle_options" boolean DEFAULT true NOT NULL,
	"show_answers" text DEFAULT 'after_close' NOT NULL,
	"pass_percent" numeric(5,2) DEFAULT '40' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "quizzes_show_answers_chk" CHECK ("show_answers" in ('never', 'after_submit', 'after_close')),
	CONSTRAINT "quizzes_status_chk" CHECK ("status" in ('draft', 'published', 'closed')),
	CONSTRAINT "quizzes_section_ids_some" CHECK (cardinality("section_ids") >= 1),
	CONSTRAINT "quizzes_closes_at_after" CHECK ("closes_at" > "opens_at"),
	CONSTRAINT "quizzes_duration_minutes_pos" CHECK ("duration_minutes" > 0),
	CONSTRAINT "quizzes_attempts_allowed_range" CHECK ("attempts_allowed" between 1 and 5),
	CONSTRAINT "quizzes_pass_percent_range" CHECK ("pass_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resource_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"resource_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_eligibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "exam_eligibility_status_chk" CHECK ("status" in ('blocked', 'allowed')),
	CONSTRAINT "exam_eligibility_reason_chk" CHECK ("reason" in ('attendance_shortage', 'fee_dues', 'disciplinary', 'other'))
);
--> statement-breakpoint
ALTER TABLE "exam_eligibility" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_invigilation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_paper_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"duty" text DEFAULT 'invigilator' NOT NULL,
	CONSTRAINT "exam_invigilation_duty_chk" CHECK ("duty" in ('chief', 'invigilator', 'reliever'))
);
--> statement-breakpoint
ALTER TABLE "exam_invigilation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_paper_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_paper_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"marker_staff_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone,
	"submitted_by" uuid,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"locked_at" timestamp with time zone,
	"locked_by" uuid,
	"return_reason" text,
	CONSTRAINT "exam_paper_sections_status_chk" CHECK ("status" in ('pending', 'in_progress', 'submitted', 'returned', 'verified', 'locked'))
);
--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"grade_subject_id" uuid NOT NULL,
	"component" text DEFAULT 'theory' NOT NULL,
	"paper_date" date,
	"start_time" time,
	"end_time" time,
	"max_marks" numeric(6,2) NOT NULL,
	"pass_marks" numeric(6,2) NOT NULL,
	"question_paper_id" uuid,
	"syllabus_note" text,
	"status" text DEFAULT 'planned' NOT NULL,
	CONSTRAINT "exam_papers_component_chk" CHECK ("component" in ('theory', 'practical', 'oral', 'project')),
	CONSTRAINT "exam_papers_status_chk" CHECK ("status" in ('planned', 'scheduled', 'conducted', 'cancelled')),
	CONSTRAINT "exam_papers_paper_date_needed" CHECK ("status" not in ('scheduled', 'conducted') or ("paper_date" is not null and "start_time" is not null)),
	CONSTRAINT "exam_papers_end_time_after" CHECK ("end_time" > "start_time"),
	CONSTRAINT "exam_papers_max_marks_pos" CHECK ("max_marks" > 0),
	CONSTRAINT "exam_papers_pass_marks_upto" CHECK ("pass_marks" <= "max_marks"),
	CONSTRAINT "exam_papers_pass_marks_min" CHECK ("pass_marks" >= 0)
);
--> statement-breakpoint
ALTER TABLE "exam_papers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_seating" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"seat_label" text NOT NULL,
	"roll_no" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_seating" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exam_types" (
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
	"kind" text NOT NULL,
	"default_weight" numeric(5,2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "exam_types_kind_chk" CHECK ("kind" in ('class_test', 'monthly', 'term', 'final', 'pre_board', 'mock')),
	CONSTRAINT "exam_types_default_weight_range" CHECK ("default_weight" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "exam_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exams" (
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
	"term_id" uuid,
	"exam_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"marks_due_on" date,
	"grading_scheme_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"datesheet_published_at" timestamp with time zone,
	"note" text,
	CONSTRAINT "exams_status_chk" CHECK ("status" in ('draft', 'scheduled', 'in_progress', 'marks_entry', 'under_review', 'published', 'cancelled')),
	CONSTRAINT "exams_ends_on_from" CHECK ("ends_on" >= "starts_on")
);
--> statement-breakpoint
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mark_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"mark_entry_id" uuid NOT NULL,
	"old_status" text NOT NULL,
	"old_marks" numeric(6,2),
	"new_status" text NOT NULL,
	"new_marks" numeric(6,2),
	"reason" text NOT NULL,
	"approval_request_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "mark_corrections_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'applied')),
	CONSTRAINT "mark_corrections_reason_len" CHECK (char_length("reason") >= 10)
);
--> statement-breakpoint
ALTER TABLE "mark_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mark_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"exam_paper_section_id" uuid NOT NULL,
	"exam_paper_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"status" text DEFAULT 'present' NOT NULL,
	"marks" numeric(6,2),
	"remark" text,
	"entered_by" uuid NOT NULL,
	"entered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "mark_entries_status_chk" CHECK ("status" in ('present', 'absent', 'exempt', 'medical', 'malpractice')),
	CONSTRAINT "mark_entries_marks_needed" CHECK ("status" <> 'present' or "marks" is not null),
	CONSTRAINT "mark_entries_marks_min" CHECK ("marks" >= 0)
);
--> statement-breakpoint
ALTER TABLE "mark_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mark_question_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"mark_entry_id" uuid NOT NULL,
	"question_no" text NOT NULL,
	"unit_id" uuid,
	"outcome_id" uuid,
	"max_marks" numeric(5,2) NOT NULL,
	"marks" numeric(5,2) NOT NULL,
	CONSTRAINT "mark_question_scores_max_marks_pos" CHECK ("max_marks" > 0),
	CONSTRAINT "mark_question_scores_marks_within" CHECK ("marks" >= 0 and "marks" <= "max_marks")
);
--> statement-breakpoint
ALTER TABLE "mark_question_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "board_registrations" (
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
	"board_id" uuid NOT NULL,
	"level" text NOT NULL,
	"exam_year" integer NOT NULL,
	"exam_session" text DEFAULT 'annual' NOT NULL,
	"subject_group_id" uuid,
	"registration_no" text,
	"board_roll_no" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"board_fee_paid" boolean DEFAULT false NOT NULL,
	"submitted_on" date,
	"note" text,
	CONSTRAINT "board_registrations_level_chk" CHECK ("level" in ('grade_5', 'grade_8', 'ssc_1', 'ssc_2')),
	CONSTRAINT "board_registrations_exam_session_chk" CHECK ("exam_session" in ('annual', 'supplementary')),
	CONSTRAINT "board_registrations_status_chk" CHECK ("status" in ('pending', 'submitted', 'registered', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "board_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "board_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"board_registration_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"total_obtained" numeric(8,2),
	"total_max" numeric(8,2),
	"grade_letter" text,
	"grade_point" numeric(4,2),
	"outcome" text DEFAULT 'awaited' NOT NULL,
	"subjects" jsonb DEFAULT '[]' NOT NULL,
	"result_date" date,
	"file_id" uuid,
	CONSTRAINT "board_results_outcome_chk" CHECK ("outcome" in ('awaited', 'pass', 'fail', 'compartment', 'absent', 'withheld'))
);
--> statement-breakpoint
ALTER TABLE "board_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "co_scholastic_areas" (
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
	"scale" text DEFAULT 'a_to_e' NOT NULL,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "co_scholastic_areas_scale_chk" CHECK ("scale" in ('a_to_e', 'stars_5', 'three_point', 'text'))
);
--> statement-breakpoint
ALTER TABLE "co_scholastic_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "co_scholastic_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"result_set_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"score" text NOT NULL,
	"entered_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_card_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"layout" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"options" jsonb DEFAULT '{}' NOT NULL,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "report_card_templates_layout_chk" CHECK ("layout" in ('standard', 'compact', 'primary_descriptive', 'board_style', 'cumulative')),
	CONSTRAINT "report_card_templates_language_chk" CHECK ("language" in ('en', 'ur', 'both')),
	CONSTRAINT "report_card_templates_status_chk" CHECK ("status" in ('draft', 'active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "report_card_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "report_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"result_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"document_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	CONSTRAINT "report_cards_status_chk" CHECK ("status" in ('pending', 'generated', 'failed', 'superseded')),
	CONSTRAINT "report_cards_revision_pos" CHECK ("revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "report_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "result_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"grade_ids" uuid[] NOT NULL,
	"pass_rule" text DEFAULT 'every_subject' NOT NULL,
	"min_aggregate_percent" numeric(5,2) DEFAULT '40' NOT NULL,
	"components_pass_separately" boolean DEFAULT true NOT NULL,
	"compartment_max_subjects" integer DEFAULT 0 NOT NULL,
	"grace_marks_total" numeric(5,2) DEFAULT '0' NOT NULL,
	"grace_marks_per_subject" numeric(5,2) DEFAULT '0' NOT NULL,
	"grace_max_subjects" integer DEFAULT 0 NOT NULL,
	"position_method" text DEFAULT 'dense' NOT NULL,
	"position_scope" text DEFAULT 'section' NOT NULL,
	"positions_need_pass" boolean DEFAULT true NOT NULL,
	"percent_decimals" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "result_policies_pass_rule_chk" CHECK ("pass_rule" in ('every_subject', 'aggregate', 'every_subject_and_aggregate')),
	CONSTRAINT "result_policies_position_method_chk" CHECK ("position_method" in ('none', 'dense', 'competition')),
	CONSTRAINT "result_policies_position_scope_chk" CHECK ("position_scope" in ('section', 'grade', 'both')),
	CONSTRAINT "result_policies_min_aggregate_percent_range" CHECK ("min_aggregate_percent" between 0 and 100),
	CONSTRAINT "result_policies_compartment_max_subjects_min" CHECK ("compartment_max_subjects" >= 0),
	CONSTRAINT "result_policies_grace_marks_total_min" CHECK ("grace_marks_total" >= 0),
	CONSTRAINT "result_policies_grace_marks_per_subject_min" CHECK ("grace_marks_per_subject" >= 0),
	CONSTRAINT "result_policies_grace_max_subjects_min" CHECK ("grace_max_subjects" >= 0),
	CONSTRAINT "result_policies_percent_decimals_range" CHECK ("percent_decimals" between 0 and 2)
);
--> statement-breakpoint
ALTER TABLE "result_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "result_set_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"result_set_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"weight_percent" numeric(5,2) NOT NULL,
	CONSTRAINT "result_set_components_weight_percent_pos" CHECK ("weight_percent" > 0),
	CONSTRAINT "result_set_components_weight_percent_max" CHECK ("weight_percent" <= 100)
);
--> statement-breakpoint
ALTER TABLE "result_set_components" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "result_sets" (
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
	"term_id" uuid,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"exam_id" uuid,
	"grade_ids" uuid[] NOT NULL,
	"policy_id" uuid NOT NULL,
	"grading_scheme_id" uuid NOT NULL,
	"frozen_rules" jsonb,
	"template_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"computed_at" timestamp with time zone,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"show_positions" boolean DEFAULT true NOT NULL,
	CONSTRAINT "result_sets_kind_chk" CHECK ("kind" in ('exam', 'term', 'annual')),
	CONSTRAINT "result_sets_status_chk" CHECK ("status" in ('draft', 'computed', 'under_review', 'published', 'withdrawn')),
	CONSTRAINT "result_sets_exam_id_needed" CHECK ("kind" <> 'exam' or "exam_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "result_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "result_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"result_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"grade_subject_id" uuid NOT NULL,
	"subject_name" text NOT NULL,
	"theory_obtained" numeric(6,2),
	"theory_max" numeric(6,2),
	"practical_obtained" numeric(6,2),
	"practical_max" numeric(6,2),
	"obtained" numeric(6,2) NOT NULL,
	"max" numeric(6,2) NOT NULL,
	"grace_marks" numeric(5,2) DEFAULT '0' NOT NULL,
	"percent" numeric(5,2) NOT NULL,
	"grade_letter" text,
	"grade_point" numeric(4,2),
	"status" text NOT NULL,
	"position_section" integer,
	CONSTRAINT "result_subjects_status_chk" CHECK ("status" in ('pass', 'fail', 'absent', 'exempt'))
);
--> statement-breakpoint
ALTER TABLE "result_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"result_set_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"total_obtained" numeric(8,2) NOT NULL,
	"total_max" numeric(8,2) NOT NULL,
	"grace_marks" numeric(5,2) DEFAULT '0' NOT NULL,
	"percent" numeric(5,2) NOT NULL,
	"grade_letter" text,
	"grade_point" numeric(4,2),
	"outcome" text NOT NULL,
	"failed_subjects" integer DEFAULT 0 NOT NULL,
	"position_section" integer,
	"position_grade" integer,
	"days_present" integer,
	"days_total" integer,
	"teacher_remark" text,
	"teacher_remark_ur" text,
	"head_remark" text,
	"remark_source" text DEFAULT 'none' NOT NULL,
	"is_withheld" boolean DEFAULT false NOT NULL,
	"withheld_reason" text,
	"withheld_note" text,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "results_outcome_chk" CHECK ("outcome" in ('pass', 'fail', 'compartment', 'absent', 'incomplete')),
	CONSTRAINT "results_remark_source_chk" CHECK ("remark_source" in ('none', 'written', 'ai_accepted', 'ai_edited')),
	CONSTRAINT "results_withheld_reason_chk" CHECK ("withheld_reason" in ('fee_dues', 'disciplinary', 'incomplete', 'other')),
	CONSTRAINT "results_failed_subjects_min" CHECK ("failed_subjects" >= 0),
	CONSTRAINT "results_revision_pos" CHECK ("revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "paper_blueprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"grade_subject_id" uuid,
	"board_id" uuid,
	"total_marks" numeric(6,2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"sections" jsonb NOT NULL,
	"unit_weights" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "paper_blueprints_total_marks_pos" CHECK ("total_marks" > 0),
	CONSTRAINT "paper_blueprints_duration_minutes_pos" CHECK ("duration_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "paper_blueprints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "paper_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"question_paper_id" uuid NOT NULL,
	"paper_section_id" uuid NOT NULL,
	"question_id" uuid,
	"sort_order" integer NOT NULL,
	"number_label" text NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"text_ur" text,
	"options" jsonb DEFAULT '[]' NOT NULL,
	"answer" jsonb,
	"marks" numeric(5,2) NOT NULL,
	"unit_id" uuid,
	"outcome_id" uuid,
	"is_ai_written" boolean DEFAULT false NOT NULL,
	"ai_accepted_by" uuid,
	"ai_accepted_at" timestamp with time zone,
	CONSTRAINT "paper_questions_marks_pos" CHECK ("marks" > 0)
);
--> statement-breakpoint
ALTER TABLE "paper_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "paper_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"question_paper_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"title" text NOT NULL,
	"instructions" text,
	"attempt_count" integer,
	"marks_each" numeric(5,2)
);
--> statement-breakpoint
ALTER TABLE "paper_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "question_papers" (
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
	"blueprint_id" uuid,
	"title" text NOT NULL,
	"set_label" text,
	"total_marks" numeric(6,2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"instructions" text,
	"language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_confidential" boolean DEFAULT true NOT NULL,
	"opens_on" date,
	"created_by_staff_id" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"document_id" uuid,
	"key_document_id" uuid,
	CONSTRAINT "question_papers_language_chk" CHECK ("language" in ('en', 'ur', 'both')),
	CONSTRAINT "question_papers_status_chk" CHECK ("status" in ('draft', 'in_review', 'approved', 'printed', 'used', 'archived')),
	CONSTRAINT "question_papers_total_marks_pos" CHECK ("total_marks" > 0),
	CONSTRAINT "question_papers_duration_minutes_pos" CHECK ("duration_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "question_papers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"grade_subject_id" uuid NOT NULL,
	"unit_id" uuid,
	"outcome_id" uuid,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"text_ur" text,
	"options" jsonb DEFAULT '[]' NOT NULL,
	"answer" jsonb,
	"marking_scheme" text,
	"marks" numeric(5,2) NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"cognitive_level" text DEFAULT 'understanding' NOT NULL,
	"source" text DEFAULT 'written' NOT NULL,
	"source_note" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_by_staff_id" uuid,
	"times_used" integer DEFAULT 0 NOT NULL,
	"last_used_on" date,
	CONSTRAINT "questions_type_chk" CHECK ("type" in ('mcq', 'true_false', 'fill_blank', 'match', 'short', 'long', 'numerical')),
	CONSTRAINT "questions_difficulty_chk" CHECK ("difficulty" in ('easy', 'medium', 'hard')),
	CONSTRAINT "questions_cognitive_level_chk" CHECK ("cognitive_level" in ('knowledge', 'understanding', 'application')),
	CONSTRAINT "questions_source_chk" CHECK ("source" in ('written', 'imported', 'ai', 'past_paper')),
	CONSTRAINT "questions_status_chk" CHECK ("status" in ('draft', 'pending_review', 'approved', 'retired')),
	CONSTRAINT "questions_options_needed" CHECK ("type" not in ('mcq', 'match') or "options" <> '[]'::jsonb),
	CONSTRAINT "questions_marks_pos" CHECK ("marks" > 0),
	CONSTRAINT "questions_times_used_min" CHECK ("times_used" >= 0)
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "behaviour_categories" (
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
	"kind" text NOT NULL,
	"severity" text DEFAULT 'low' NOT NULL,
	"default_points" integer NOT NULL,
	"notify_guardian" text DEFAULT 'digest' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "behaviour_categories_kind_chk" CHECK ("kind" in ('positive', 'negative')),
	CONSTRAINT "behaviour_categories_severity_chk" CHECK ("severity" in ('low', 'medium', 'high')),
	CONSTRAINT "behaviour_categories_notify_guardian_chk" CHECK ("notify_guardian" in ('never', 'digest', 'immediately')),
	CONSTRAINT "behaviour_categories_default_points_sign" CHECK (("kind" = 'positive' and "default_points" >= 0) or ("kind" = 'negative' and "default_points" <= 0))
);
--> statement-breakpoint
ALTER TABLE "behaviour_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "behaviour_concerns" (
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
	"title" text NOT NULL,
	"level" text DEFAULT 'class' NOT NULL,
	"owner_staff_id" uuid NOT NULL,
	"opened_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"guardian_informed" boolean DEFAULT false NOT NULL,
	"closed_on" date,
	"outcome" text,
	CONSTRAINT "behaviour_concerns_level_chk" CHECK ("level" in ('class', 'section', 'principal')),
	CONSTRAINT "behaviour_concerns_status_chk" CHECK ("status" in ('open', 'monitoring', 'closed')),
	CONSTRAINT "behaviour_concerns_outcome_needed" CHECK ("status" <> 'closed' or ("outcome" is not null and "closed_on" is not null))
);
--> statement-breakpoint
ALTER TABLE "behaviour_concerns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "behaviour_record_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"behaviour_record_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "behaviour_record_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "behaviour_records" (
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
	"category_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"points" integer NOT NULL,
	"occurred_on" date NOT NULL,
	"section_id" uuid NOT NULL,
	"reported_by_staff_id" uuid NOT NULL,
	"description" text,
	"place" text,
	"visibility" text DEFAULT 'family' NOT NULL,
	"status" text DEFAULT 'recorded' NOT NULL,
	"void_reason" text,
	"concern_id" uuid,
	CONSTRAINT "behaviour_records_kind_chk" CHECK ("kind" in ('positive', 'negative')),
	CONSTRAINT "behaviour_records_visibility_chk" CHECK ("visibility" in ('family', 'staff')),
	CONSTRAINT "behaviour_records_status_chk" CHECK ("status" in ('recorded', 'under_review', 'confirmed', 'void'))
);
--> statement-breakpoint
ALTER TABLE "behaviour_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "concern_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"concern_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"action" text NOT NULL,
	"action_date" date NOT NULL,
	"to_date" date,
	"assigned_to_staff_id" uuid,
	"note" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"approval_request_id" uuid,
	"share_with_family" boolean DEFAULT true NOT NULL,
	CONSTRAINT "concern_actions_action_chk" CHECK ("action" in ('verbal_warning', 'written_warning', 'detention', 'parent_meeting', 'counselling_referral', 'community_service', 'suspension', 'other')),
	CONSTRAINT "concern_actions_status_chk" CHECK ("status" in ('planned', 'done', 'cancelled')),
	CONSTRAINT "concern_actions_to_date_from" CHECK ("to_date" >= "action_date"),
	CONSTRAINT "concern_actions_to_date_needed" CHECK ("action" <> 'suspension' or "to_date" is not null)
);
--> statement-breakpoint
ALTER TABLE "concern_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "counselling_notes" (
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
	"counsellor_staff_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"follow_up_on" date,
	"risk_flag" text DEFAULT 'none' NOT NULL,
	"referred_by_staff_id" uuid,
	CONSTRAINT "counselling_notes_kind_chk" CHECK ("kind" in ('academic', 'behavioural', 'emotional', 'family', 'career', 'other')),
	CONSTRAINT "counselling_notes_risk_flag_chk" CHECK ("risk_flag" in ('none', 'watch', 'urgent'))
);
--> statement-breakpoint
ALTER TABLE "counselling_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "house_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"house_id" uuid NOT NULL,
	"student_id" uuid,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"behaviour_record_id" uuid,
	"academic_year_id" uuid NOT NULL,
	"awarded_on" date NOT NULL,
	"awarded_by" uuid NOT NULL,
	CONSTRAINT "house_points_source_chk" CHECK ("source" in ('behaviour', 'event', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "house_points" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "houses" (
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
	"colour" text NOT NULL,
	"motto" text,
	"house_master_staff_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "houses_colour_hex" CHECK ("colour" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "houses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "students_house_id_fk_idx" ON "students" ("house_id") WHERE "house_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "bell_periods_bell_schedule_sequence_uq" ON "bell_periods" ("bell_schedule_id","sequence") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "bell_periods_bell_schedule_lesson_no_uq" ON "bell_periods" ("bell_schedule_id","lesson_no") WHERE "deleted_at" is null and "lesson_no" is not null;--> statement-breakpoint
CREATE INDEX "bell_periods_branch_id_fk_idx" ON "bell_periods" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bell_schedules_branch_name_uq" ON "bell_schedules" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "bell_schedules_shift_id_fk_idx" ON "bell_schedules" ("shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "substitutions_substitution_date_timetable_entry_uq" ON "substitutions" ("substitution_date","timetable_entry_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "substitutions_substitution_date_substitute_teacher_lesson_no_uq" ON "substitutions" ("substitution_date","substitute_teacher_id","lesson_no") WHERE "deleted_at" is null and "substitute_teacher_id" is not null;--> statement-breakpoint
CREATE INDEX "substitutions_branch_id_fk_idx" ON "substitutions" ("branch_id");--> statement-breakpoint
CREATE INDEX "substitutions_timetable_entry_id_fk_idx" ON "substitutions" ("timetable_entry_id");--> statement-breakpoint
CREATE INDEX "substitutions_section_id_fk_idx" ON "substitutions" ("section_id");--> statement-breakpoint
CREATE INDEX "substitutions_absent_teacher_id_fk_idx" ON "substitutions" ("absent_teacher_id");--> statement-breakpoint
CREATE INDEX "substitutions_substitute_teacher_id_fk_idx" ON "substitutions" ("substitute_teacher_id") WHERE "substitute_teacher_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_availability_staff_weekday_lesson_no_uq" ON "teacher_availability" ("staff_id","weekday","lesson_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "teacher_availability_branch_id_fk_idx" ON "teacher_availability" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_entries_timetable_section_weekday_lesson_no_uq" ON "timetable_entries" ("timetable_id","section_id","weekday","lesson_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_entries_timetable_teacher_weekday_lesson_no_uq" ON "timetable_entries" ("timetable_id","teacher_id","weekday","lesson_no") WHERE "deleted_at" is null and "teacher_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_entries_timetable_room_weekday_lesson_no_uq" ON "timetable_entries" ("timetable_id","room_id","weekday","lesson_no") WHERE "deleted_at" is null and "room_id" is not null;--> statement-breakpoint
CREATE INDEX "timetable_entries_branch_id_fk_idx" ON "timetable_entries" ("branch_id");--> statement-breakpoint
CREATE INDEX "timetable_entries_section_id_fk_idx" ON "timetable_entries" ("section_id");--> statement-breakpoint
CREATE INDEX "timetable_entries_section_subject_id_fk_idx" ON "timetable_entries" ("section_subject_id");--> statement-breakpoint
CREATE INDEX "timetable_entries_teacher_id_fk_idx" ON "timetable_entries" ("teacher_id") WHERE "teacher_id" is not null;--> statement-breakpoint
CREATE INDEX "timetable_entries_room_id_fk_idx" ON "timetable_entries" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "timetables_branch_id_fk_idx" ON "timetables" ("branch_id");--> statement-breakpoint
CREATE INDEX "timetables_academic_year_id_fk_idx" ON "timetables" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "timetables_shift_id_fk_idx" ON "timetables" ("shift_id");--> statement-breakpoint
CREATE INDEX "timetables_published_by_fk_idx" ON "timetables" ("published_by") WHERE "published_by" is not null;--> statement-breakpoint
CREATE INDEX "timetables_copied_from_id_fk_idx" ON "timetables" ("copied_from_id") WHERE "copied_from_id" is not null;--> statement-breakpoint
CREATE INDEX "learning_outcomes_unit_id_fk_idx" ON "learning_outcomes" ("unit_id");--> statement-breakpoint
CREATE INDEX "lesson_plans_teacher_plan_date_idx" ON "lesson_plans" ("org_id","teacher_id","plan_date");--> statement-breakpoint
CREATE INDEX "lesson_plans_section_subject_plan_date_idx" ON "lesson_plans" ("org_id","section_subject_id","plan_date");--> statement-breakpoint
CREATE INDEX "lesson_plans_branch_id_fk_idx" ON "lesson_plans" ("branch_id");--> statement-breakpoint
CREATE INDEX "lesson_plans_section_subject_id_fk_idx" ON "lesson_plans" ("section_subject_id");--> statement-breakpoint
CREATE INDEX "lesson_plans_teacher_id_fk_idx" ON "lesson_plans" ("teacher_id");--> statement-breakpoint
CREATE INDEX "lesson_plans_unit_id_fk_idx" ON "lesson_plans" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE INDEX "lesson_plans_reviewed_by_fk_idx" ON "lesson_plans" ("reviewed_by") WHERE "reviewed_by" is not null;--> statement-breakpoint
CREATE INDEX "lesson_plans_copied_from_id_fk_idx" ON "lesson_plans" ("copied_from_id") WHERE "copied_from_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "scheme_weeks_scheme_week_no_uq" ON "scheme_weeks" ("scheme_id","week_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "scheme_weeks_branch_id_fk_idx" ON "scheme_weeks" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schemes_of_work_branch_term_grade_subject_section_uq" ON "schemes_of_work" ("branch_id","term_id","grade_subject_id",coalesce("section_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "schemes_of_work_academic_year_id_fk_idx" ON "schemes_of_work" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "schemes_of_work_term_id_fk_idx" ON "schemes_of_work" ("term_id");--> statement-breakpoint
CREATE INDEX "schemes_of_work_grade_subject_id_fk_idx" ON "schemes_of_work" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "schemes_of_work_section_id_fk_idx" ON "schemes_of_work" ("section_id") WHERE "section_id" is not null;--> statement-breakpoint
CREATE INDEX "schemes_of_work_submitted_by_fk_idx" ON "schemes_of_work" ("submitted_by") WHERE "submitted_by" is not null;--> statement-breakpoint
CREATE INDEX "schemes_of_work_approved_by_fk_idx" ON "schemes_of_work" ("approved_by") WHERE "approved_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_progress_section_subject_unit_uq" ON "syllabus_progress" ("section_subject_id","unit_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "syllabus_progress_branch_id_fk_idx" ON "syllabus_progress" ("branch_id");--> statement-breakpoint
CREATE INDEX "syllabus_progress_unit_id_fk_idx" ON "syllabus_progress" ("unit_id");--> statement-breakpoint
CREATE INDEX "syllabus_units_grade_subject_parent_sort_order_idx" ON "syllabus_units" ("org_id","grade_subject_id","parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "syllabus_units_grade_subject_id_fk_idx" ON "syllabus_units" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "syllabus_units_parent_id_fk_idx" ON "syllabus_units" ("parent_id") WHERE "parent_id" is not null;--> statement-breakpoint
CREATE INDEX "attendance_corrections_branch_id_fk_idx" ON "attendance_corrections" ("branch_id");--> statement-breakpoint
CREATE INDEX "attendance_corrections_record_id_fk_idx" ON "attendance_corrections" ("record_id");--> statement-breakpoint
CREATE INDEX "attendance_corrections_decided_by_fk_idx" ON "attendance_corrections" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_session_student_uq" ON "attendance_records" ("session_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "attendance_records_student_session_date_idx" ON "attendance_records" ("org_id","student_id","session_date");--> statement-breakpoint
CREATE INDEX "attendance_records_branch_session_date_status_idx" ON "attendance_records" ("org_id","branch_id","session_date","status");--> statement-breakpoint
CREATE INDEX "attendance_records_branch_id_fk_idx" ON "attendance_records" ("branch_id");--> statement-breakpoint
CREATE INDEX "attendance_records_student_id_fk_idx" ON "attendance_records" ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_records_enrollment_id_fk_idx" ON "attendance_records" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "attendance_records_marked_by_fk_idx" ON "attendance_records" ("marked_by");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_sessions_section_session_date_lesson_no_uq" ON "attendance_sessions" ("section_id","session_date","lesson_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "attendance_sessions_branch_session_date_idx" ON "attendance_sessions" ("org_id","branch_id","session_date");--> statement-breakpoint
CREATE INDEX "attendance_sessions_branch_id_fk_idx" ON "attendance_sessions" ("branch_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_section_subject_id_fk_idx" ON "attendance_sessions" ("section_subject_id") WHERE "section_subject_id" is not null;--> statement-breakpoint
CREATE INDEX "attendance_sessions_taken_by_fk_idx" ON "attendance_sessions" ("taken_by");--> statement-breakpoint
CREATE INDEX "student_leave_requests_branch_id_fk_idx" ON "student_leave_requests" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_leave_requests_student_id_fk_idx" ON "student_leave_requests" ("student_id");--> statement-breakpoint
CREATE INDEX "student_leave_requests_file_id_fk_idx" ON "student_leave_requests" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "student_leave_requests_decided_by_fk_idx" ON "student_leave_requests" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "diary_acknowledgements_student_entry_date_uq" ON "diary_acknowledgements" ("student_id","entry_date") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "diary_acknowledgements_branch_id_fk_idx" ON "diary_acknowledgements" ("branch_id");--> statement-breakpoint
CREATE INDEX "diary_acknowledgements_section_id_fk_idx" ON "diary_acknowledgements" ("section_id");--> statement-breakpoint
CREATE INDEX "diary_acknowledgements_acknowledged_by_fk_idx" ON "diary_acknowledgements" ("acknowledged_by");--> statement-breakpoint
CREATE UNIQUE INDEX "diary_entries_section_entry_date_section_subject_uq" ON "diary_entries" ("section_id","entry_date",coalesce("section_subject_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "diary_entries_branch_id_fk_idx" ON "diary_entries" ("branch_id");--> statement-breakpoint
CREATE INDEX "diary_entries_section_subject_id_fk_idx" ON "diary_entries" ("section_subject_id") WHERE "section_subject_id" is not null;--> statement-breakpoint
CREATE INDEX "diary_entries_posted_by_fk_idx" ON "diary_entries" ("posted_by");--> statement-breakpoint
CREATE INDEX "homework_section_due_date_idx" ON "homework" ("org_id","section_id","due_date");--> statement-breakpoint
CREATE INDEX "homework_assigned_by_assigned_on_idx" ON "homework" ("org_id","assigned_by","assigned_on");--> statement-breakpoint
CREATE INDEX "homework_branch_id_fk_idx" ON "homework" ("branch_id");--> statement-breakpoint
CREATE INDEX "homework_section_subject_id_fk_idx" ON "homework" ("section_subject_id");--> statement-breakpoint
CREATE INDEX "homework_section_id_fk_idx" ON "homework" ("section_id");--> statement-breakpoint
CREATE INDEX "homework_assigned_by_fk_idx" ON "homework" ("assigned_by");--> statement-breakpoint
CREATE INDEX "homework_unit_id_fk_idx" ON "homework" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "homework_submissions_homework_student_uq" ON "homework_submissions" ("homework_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "homework_submissions_branch_id_fk_idx" ON "homework_submissions" ("branch_id");--> statement-breakpoint
CREATE INDEX "homework_submissions_student_id_fk_idx" ON "homework_submissions" ("student_id");--> statement-breakpoint
CREATE INDEX "homework_submissions_checked_by_fk_idx" ON "homework_submissions" ("checked_by") WHERE "checked_by" is not null;--> statement-breakpoint
CREATE INDEX "learning_resources_grade_subject_unit_status_idx" ON "learning_resources" ("org_id","grade_subject_id","unit_id","status");--> statement-breakpoint
CREATE INDEX "learning_resources_grade_subject_id_fk_idx" ON "learning_resources" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "learning_resources_unit_id_fk_idx" ON "learning_resources" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE INDEX "learning_resources_file_id_fk_idx" ON "learning_resources" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "learning_resources_created_by_staff_id_fk_idx" ON "learning_resources" ("created_by_staff_id");--> statement-breakpoint
CREATE INDEX "live_classes_branch_id_fk_idx" ON "live_classes" ("branch_id");--> statement-breakpoint
CREATE INDEX "live_classes_section_subject_id_fk_idx" ON "live_classes" ("section_subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_answers_attempt_quiz_question_uq" ON "quiz_answers" ("attempt_id","quiz_question_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "quiz_answers_branch_id_fk_idx" ON "quiz_answers" ("branch_id");--> statement-breakpoint
CREATE INDEX "quiz_answers_student_id_fk_idx" ON "quiz_answers" ("student_id");--> statement-breakpoint
CREATE INDEX "quiz_answers_quiz_question_id_fk_idx" ON "quiz_answers" ("quiz_question_id");--> statement-breakpoint
CREATE INDEX "quiz_answers_graded_by_fk_idx" ON "quiz_answers" ("graded_by") WHERE "graded_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_quiz_student_attempt_no_uq" ON "quiz_attempts" ("quiz_id","student_id","attempt_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "quiz_attempts_branch_id_fk_idx" ON "quiz_attempts" ("branch_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_student_id_fk_idx" ON "quiz_attempts" ("student_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_branch_id_fk_idx" ON "quiz_questions" ("branch_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_quiz_id_fk_idx" ON "quiz_questions" ("quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_question_id_fk_idx" ON "quiz_questions" ("question_id") WHERE "question_id" is not null;--> statement-breakpoint
CREATE INDEX "quizzes_branch_id_fk_idx" ON "quizzes" ("branch_id");--> statement-breakpoint
CREATE INDEX "quizzes_grade_subject_id_fk_idx" ON "quizzes" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "quizzes_created_by_staff_id_fk_idx" ON "quizzes" ("created_by_staff_id");--> statement-breakpoint
CREATE INDEX "quizzes_unit_id_fk_idx" ON "quizzes" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE INDEX "resource_views_resource_idx" ON "resource_views" ("org_id","resource_id");--> statement-breakpoint
CREATE INDEX "resource_views_student_viewed_at_idx" ON "resource_views" ("org_id","student_id","viewed_at");--> statement-breakpoint
CREATE INDEX "resource_views_resource_id_fk_idx" ON "resource_views" ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_views_student_id_fk_idx" ON "resource_views" ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_eligibility_exam_student_reason_uq" ON "exam_eligibility" ("exam_id","student_id","reason") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exam_eligibility_branch_id_fk_idx" ON "exam_eligibility" ("branch_id");--> statement-breakpoint
CREATE INDEX "exam_eligibility_student_id_fk_idx" ON "exam_eligibility" ("student_id");--> statement-breakpoint
CREATE INDEX "exam_eligibility_decided_by_fk_idx" ON "exam_eligibility" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_grades_exam_grade_uq" ON "exam_grades" ("exam_id","grade_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exam_grades_branch_id_fk_idx" ON "exam_grades" ("branch_id");--> statement-breakpoint
CREATE INDEX "exam_grades_grade_id_fk_idx" ON "exam_grades" ("grade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_invigilation_exam_paper_room_staff_uq" ON "exam_invigilation" ("exam_paper_id","room_id","staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exam_invigilation_branch_id_fk_idx" ON "exam_invigilation" ("branch_id");--> statement-breakpoint
CREATE INDEX "exam_invigilation_room_id_fk_idx" ON "exam_invigilation" ("room_id");--> statement-breakpoint
CREATE INDEX "exam_invigilation_staff_id_fk_idx" ON "exam_invigilation" ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_paper_sections_exam_paper_section_uq" ON "exam_paper_sections" ("exam_paper_id","section_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exam_paper_sections_marker_staff_status_idx" ON "exam_paper_sections" ("org_id","marker_staff_id","status");--> statement-breakpoint
CREATE INDEX "exam_paper_sections_branch_id_fk_idx" ON "exam_paper_sections" ("branch_id");--> statement-breakpoint
CREATE INDEX "exam_paper_sections_section_id_fk_idx" ON "exam_paper_sections" ("section_id");--> statement-breakpoint
CREATE INDEX "exam_paper_sections_marker_staff_id_fk_idx" ON "exam_paper_sections" ("marker_staff_id") WHERE "marker_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "exam_paper_sections_submitted_by_fk_idx" ON "exam_paper_sections" ("submitted_by") WHERE "submitted_by" is not null;--> statement-breakpoint
CREATE INDEX "exam_paper_sections_verified_by_fk_idx" ON "exam_paper_sections" ("verified_by") WHERE "verified_by" is not null;--> statement-breakpoint
CREATE INDEX "exam_paper_sections_locked_by_fk_idx" ON "exam_paper_sections" ("locked_by") WHERE "locked_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_papers_exam_grade_grade_subject_component_uq" ON "exam_papers" ("exam_id","grade_id","grade_subject_id","component") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exam_papers_branch_paper_date_idx" ON "exam_papers" ("org_id","branch_id","paper_date");--> statement-breakpoint
CREATE INDEX "exam_papers_branch_id_fk_idx" ON "exam_papers" ("branch_id");--> statement-breakpoint
CREATE INDEX "exam_papers_grade_id_fk_idx" ON "exam_papers" ("grade_id");--> statement-breakpoint
CREATE INDEX "exam_papers_grade_subject_id_fk_idx" ON "exam_papers" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "exam_papers_question_paper_id_fk_idx" ON "exam_papers" ("question_paper_id") WHERE "question_paper_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_seating_exam_student_uq" ON "exam_seating" ("exam_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_seating_exam_room_seat_label_uq" ON "exam_seating" ("exam_id","room_id","seat_label") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_seating_exam_roll_no_uq" ON "exam_seating" ("exam_id","roll_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exam_seating_branch_id_fk_idx" ON "exam_seating" ("branch_id");--> statement-breakpoint
CREATE INDEX "exam_seating_student_id_fk_idx" ON "exam_seating" ("student_id");--> statement-breakpoint
CREATE INDEX "exam_seating_room_id_fk_idx" ON "exam_seating" ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_types_name_uq" ON "exam_types" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_types_code_uq" ON "exam_types" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "exams_branch_academic_year_name_uq" ON "exams" ("branch_id","academic_year_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "exams_academic_year_id_fk_idx" ON "exams" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "exams_term_id_fk_idx" ON "exams" ("term_id") WHERE "term_id" is not null;--> statement-breakpoint
CREATE INDEX "exams_exam_type_id_fk_idx" ON "exams" ("exam_type_id");--> statement-breakpoint
CREATE INDEX "exams_grading_scheme_id_fk_idx" ON "exams" ("grading_scheme_id");--> statement-breakpoint
CREATE INDEX "mark_corrections_branch_id_fk_idx" ON "mark_corrections" ("branch_id");--> statement-breakpoint
CREATE INDEX "mark_corrections_mark_entry_id_fk_idx" ON "mark_corrections" ("mark_entry_id");--> statement-breakpoint
CREATE INDEX "mark_corrections_approval_request_id_fk_idx" ON "mark_corrections" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "mark_corrections_requested_by_fk_idx" ON "mark_corrections" ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "mark_entries_exam_paper_student_uq" ON "mark_entries" ("exam_paper_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "mark_entries_student_idx" ON "mark_entries" ("org_id","student_id");--> statement-breakpoint
CREATE INDEX "mark_entries_branch_id_fk_idx" ON "mark_entries" ("branch_id");--> statement-breakpoint
CREATE INDEX "mark_entries_exam_paper_section_id_fk_idx" ON "mark_entries" ("exam_paper_section_id");--> statement-breakpoint
CREATE INDEX "mark_entries_student_id_fk_idx" ON "mark_entries" ("student_id");--> statement-breakpoint
CREATE INDEX "mark_entries_enrollment_id_fk_idx" ON "mark_entries" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "mark_entries_entered_by_fk_idx" ON "mark_entries" ("entered_by");--> statement-breakpoint
CREATE UNIQUE INDEX "mark_question_scores_mark_entry_question_no_uq" ON "mark_question_scores" ("mark_entry_id","question_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "mark_question_scores_branch_id_fk_idx" ON "mark_question_scores" ("branch_id");--> statement-breakpoint
CREATE INDEX "mark_question_scores_unit_id_fk_idx" ON "mark_question_scores" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE INDEX "mark_question_scores_outcome_id_fk_idx" ON "mark_question_scores" ("outcome_id") WHERE "outcome_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "board_registrations_student_board_level_exam_year_exam_a2f17610" ON "board_registrations" ("student_id","board_id","level","exam_year","exam_session") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "board_registrations_branch_id_fk_idx" ON "board_registrations" ("branch_id");--> statement-breakpoint
CREATE INDEX "board_registrations_board_id_fk_idx" ON "board_registrations" ("board_id");--> statement-breakpoint
CREATE INDEX "board_registrations_subject_group_id_fk_idx" ON "board_registrations" ("subject_group_id") WHERE "subject_group_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "board_results_board_registration_uq" ON "board_results" ("board_registration_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "board_results_branch_id_fk_idx" ON "board_results" ("branch_id");--> statement-breakpoint
CREATE INDEX "board_results_student_id_fk_idx" ON "board_results" ("student_id");--> statement-breakpoint
CREATE INDEX "board_results_file_id_fk_idx" ON "board_results" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "co_scholastic_areas_name_uq" ON "co_scholastic_areas" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "co_scholastic_scores_result_set_student_area_uq" ON "co_scholastic_scores" ("result_set_id","student_id","area_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "co_scholastic_scores_branch_id_fk_idx" ON "co_scholastic_scores" ("branch_id");--> statement-breakpoint
CREATE INDEX "co_scholastic_scores_student_id_fk_idx" ON "co_scholastic_scores" ("student_id");--> statement-breakpoint
CREATE INDEX "co_scholastic_scores_area_id_fk_idx" ON "co_scholastic_scores" ("area_id");--> statement-breakpoint
CREATE INDEX "co_scholastic_scores_entered_by_fk_idx" ON "co_scholastic_scores" ("entered_by");--> statement-breakpoint
CREATE UNIQUE INDEX "report_card_templates_name_uq" ON "report_card_templates" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "report_cards_result_revision_uq" ON "report_cards" ("result_id","revision") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "report_cards_branch_id_fk_idx" ON "report_cards" ("branch_id");--> statement-breakpoint
CREATE INDEX "report_cards_student_id_fk_idx" ON "report_cards" ("student_id");--> statement-breakpoint
CREATE INDEX "report_cards_template_id_fk_idx" ON "report_cards" ("template_id");--> statement-breakpoint
CREATE INDEX "report_cards_document_id_fk_idx" ON "report_cards" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "report_cards_acknowledged_by_fk_idx" ON "report_cards" ("acknowledged_by") WHERE "acknowledged_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "result_policies_name_uq" ON "result_policies" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "result_set_components_result_set_exam_uq" ON "result_set_components" ("result_set_id","exam_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "result_set_components_branch_id_fk_idx" ON "result_set_components" ("branch_id");--> statement-breakpoint
CREATE INDEX "result_set_components_exam_id_fk_idx" ON "result_set_components" ("exam_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_sets_branch_academic_year_name_uq" ON "result_sets" ("branch_id","academic_year_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "result_sets_academic_year_id_fk_idx" ON "result_sets" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "result_sets_term_id_fk_idx" ON "result_sets" ("term_id") WHERE "term_id" is not null;--> statement-breakpoint
CREATE INDEX "result_sets_exam_id_fk_idx" ON "result_sets" ("exam_id") WHERE "exam_id" is not null;--> statement-breakpoint
CREATE INDEX "result_sets_policy_id_fk_idx" ON "result_sets" ("policy_id");--> statement-breakpoint
CREATE INDEX "result_sets_grading_scheme_id_fk_idx" ON "result_sets" ("grading_scheme_id");--> statement-breakpoint
CREATE INDEX "result_sets_template_id_fk_idx" ON "result_sets" ("template_id") WHERE "template_id" is not null;--> statement-breakpoint
CREATE INDEX "result_sets_published_by_fk_idx" ON "result_sets" ("published_by") WHERE "published_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "result_subjects_result_grade_subject_uq" ON "result_subjects" ("result_id","grade_subject_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "result_subjects_branch_id_fk_idx" ON "result_subjects" ("branch_id");--> statement-breakpoint
CREATE INDEX "result_subjects_student_id_fk_idx" ON "result_subjects" ("student_id");--> statement-breakpoint
CREATE INDEX "result_subjects_grade_subject_id_fk_idx" ON "result_subjects" ("grade_subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "results_result_set_student_uq" ON "results" ("result_set_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "results_student_idx" ON "results" ("org_id","student_id");--> statement-breakpoint
CREATE INDEX "results_result_set_section_percent_idx" ON "results" ("org_id","result_set_id","section_id","percent");--> statement-breakpoint
CREATE INDEX "results_branch_id_fk_idx" ON "results" ("branch_id");--> statement-breakpoint
CREATE INDEX "results_student_id_fk_idx" ON "results" ("student_id");--> statement-breakpoint
CREATE INDEX "results_enrollment_id_fk_idx" ON "results" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "results_section_id_fk_idx" ON "results" ("section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_blueprints_name_uq" ON "paper_blueprints" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "paper_blueprints_grade_subject_id_fk_idx" ON "paper_blueprints" ("grade_subject_id") WHERE "grade_subject_id" is not null;--> statement-breakpoint
CREATE INDEX "paper_blueprints_board_id_fk_idx" ON "paper_blueprints" ("board_id") WHERE "board_id" is not null;--> statement-breakpoint
CREATE INDEX "paper_questions_branch_id_fk_idx" ON "paper_questions" ("branch_id");--> statement-breakpoint
CREATE INDEX "paper_questions_question_paper_id_fk_idx" ON "paper_questions" ("question_paper_id");--> statement-breakpoint
CREATE INDEX "paper_questions_paper_section_id_fk_idx" ON "paper_questions" ("paper_section_id");--> statement-breakpoint
CREATE INDEX "paper_questions_question_id_fk_idx" ON "paper_questions" ("question_id") WHERE "question_id" is not null;--> statement-breakpoint
CREATE INDEX "paper_questions_unit_id_fk_idx" ON "paper_questions" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE INDEX "paper_questions_outcome_id_fk_idx" ON "paper_questions" ("outcome_id") WHERE "outcome_id" is not null;--> statement-breakpoint
CREATE INDEX "paper_questions_ai_accepted_by_fk_idx" ON "paper_questions" ("ai_accepted_by") WHERE "ai_accepted_by" is not null;--> statement-breakpoint
CREATE INDEX "paper_sections_branch_id_fk_idx" ON "paper_sections" ("branch_id");--> statement-breakpoint
CREATE INDEX "paper_sections_question_paper_id_fk_idx" ON "paper_sections" ("question_paper_id");--> statement-breakpoint
CREATE INDEX "question_papers_branch_grade_subject_status_idx" ON "question_papers" ("org_id","branch_id","grade_subject_id","status");--> statement-breakpoint
CREATE INDEX "question_papers_branch_id_fk_idx" ON "question_papers" ("branch_id");--> statement-breakpoint
CREATE INDEX "question_papers_grade_subject_id_fk_idx" ON "question_papers" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "question_papers_blueprint_id_fk_idx" ON "question_papers" ("blueprint_id") WHERE "blueprint_id" is not null;--> statement-breakpoint
CREATE INDEX "question_papers_created_by_staff_id_fk_idx" ON "question_papers" ("created_by_staff_id");--> statement-breakpoint
CREATE INDEX "question_papers_approved_by_fk_idx" ON "question_papers" ("approved_by") WHERE "approved_by" is not null;--> statement-breakpoint
CREATE INDEX "question_papers_document_id_fk_idx" ON "question_papers" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "question_papers_key_document_id_fk_idx" ON "question_papers" ("key_document_id") WHERE "key_document_id" is not null;--> statement-breakpoint
CREATE INDEX "questions_grade_subject_unit_type_status_idx" ON "questions" ("org_id","grade_subject_id","unit_id","type","status");--> statement-breakpoint
CREATE INDEX "questions_search" ON "questions" USING gin (to_tsvector('simple', coalesce("text", '')));--> statement-breakpoint
CREATE INDEX "questions_grade_subject_id_fk_idx" ON "questions" ("grade_subject_id");--> statement-breakpoint
CREATE INDEX "questions_unit_id_fk_idx" ON "questions" ("unit_id") WHERE "unit_id" is not null;--> statement-breakpoint
CREATE INDEX "questions_outcome_id_fk_idx" ON "questions" ("outcome_id") WHERE "outcome_id" is not null;--> statement-breakpoint
CREATE INDEX "questions_reviewed_by_fk_idx" ON "questions" ("reviewed_by") WHERE "reviewed_by" is not null;--> statement-breakpoint
CREATE INDEX "questions_created_by_staff_id_fk_idx" ON "questions" ("created_by_staff_id") WHERE "created_by_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "behaviour_categories_name_uq" ON "behaviour_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "behaviour_concerns_branch_id_fk_idx" ON "behaviour_concerns" ("branch_id");--> statement-breakpoint
CREATE INDEX "behaviour_concerns_student_id_fk_idx" ON "behaviour_concerns" ("student_id");--> statement-breakpoint
CREATE INDEX "behaviour_concerns_owner_staff_id_fk_idx" ON "behaviour_concerns" ("owner_staff_id");--> statement-breakpoint
CREATE INDEX "behaviour_record_notes_branch_id_fk_idx" ON "behaviour_record_notes" ("branch_id");--> statement-breakpoint
CREATE INDEX "behaviour_record_notes_behaviour_record_id_fk_idx" ON "behaviour_record_notes" ("behaviour_record_id");--> statement-breakpoint
CREATE INDEX "behaviour_record_notes_author_id_fk_idx" ON "behaviour_record_notes" ("author_id");--> statement-breakpoint
CREATE INDEX "behaviour_records_student_occurred_on_idx" ON "behaviour_records" ("org_id","student_id","occurred_on");--> statement-breakpoint
CREATE INDEX "behaviour_records_branch_occurred_on_kind_idx" ON "behaviour_records" ("org_id","branch_id","occurred_on","kind");--> statement-breakpoint
CREATE INDEX "behaviour_records_branch_id_fk_idx" ON "behaviour_records" ("branch_id");--> statement-breakpoint
CREATE INDEX "behaviour_records_student_id_fk_idx" ON "behaviour_records" ("student_id");--> statement-breakpoint
CREATE INDEX "behaviour_records_category_id_fk_idx" ON "behaviour_records" ("category_id");--> statement-breakpoint
CREATE INDEX "behaviour_records_section_id_fk_idx" ON "behaviour_records" ("section_id");--> statement-breakpoint
CREATE INDEX "behaviour_records_reported_by_staff_id_fk_idx" ON "behaviour_records" ("reported_by_staff_id");--> statement-breakpoint
CREATE INDEX "behaviour_records_concern_id_fk_idx" ON "behaviour_records" ("concern_id") WHERE "concern_id" is not null;--> statement-breakpoint
CREATE INDEX "concern_actions_branch_id_fk_idx" ON "concern_actions" ("branch_id");--> statement-breakpoint
CREATE INDEX "concern_actions_concern_id_fk_idx" ON "concern_actions" ("concern_id");--> statement-breakpoint
CREATE INDEX "concern_actions_student_id_fk_idx" ON "concern_actions" ("student_id");--> statement-breakpoint
CREATE INDEX "concern_actions_assigned_to_staff_id_fk_idx" ON "concern_actions" ("assigned_to_staff_id") WHERE "assigned_to_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "concern_actions_approval_request_id_fk_idx" ON "concern_actions" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "counselling_notes_branch_id_fk_idx" ON "counselling_notes" ("branch_id");--> statement-breakpoint
CREATE INDEX "counselling_notes_student_id_fk_idx" ON "counselling_notes" ("student_id");--> statement-breakpoint
CREATE INDEX "counselling_notes_counsellor_staff_id_fk_idx" ON "counselling_notes" ("counsellor_staff_id");--> statement-breakpoint
CREATE INDEX "counselling_notes_referred_by_staff_id_fk_idx" ON "counselling_notes" ("referred_by_staff_id") WHERE "referred_by_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "house_points_house_academic_year_idx" ON "house_points" ("org_id","house_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "house_points_branch_id_fk_idx" ON "house_points" ("branch_id");--> statement-breakpoint
CREATE INDEX "house_points_house_id_fk_idx" ON "house_points" ("house_id");--> statement-breakpoint
CREATE INDEX "house_points_student_id_fk_idx" ON "house_points" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "house_points_behaviour_record_id_fk_idx" ON "house_points" ("behaviour_record_id") WHERE "behaviour_record_id" is not null;--> statement-breakpoint
CREATE INDEX "house_points_academic_year_id_fk_idx" ON "house_points" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "house_points_awarded_by_fk_idx" ON "house_points" ("awarded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "houses_branch_name_uq" ON "houses" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "houses_house_master_staff_id_fk_idx" ON "houses" ("house_master_staff_id") WHERE "house_master_staff_id" is not null;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_house_id_houses_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id");--> statement-breakpoint
ALTER TABLE "bell_periods" ADD CONSTRAINT "bell_periods_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bell_periods" ADD CONSTRAINT "bell_periods_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "bell_periods" ADD CONSTRAINT "bell_periods_bell_schedule_id_bell_schedules_id_fkey" FOREIGN KEY ("bell_schedule_id") REFERENCES "bell_schedules"("id");--> statement-breakpoint
ALTER TABLE "bell_schedules" ADD CONSTRAINT "bell_schedules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bell_schedules" ADD CONSTRAINT "bell_schedules_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "bell_schedules" ADD CONSTRAINT "bell_schedules_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id");--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_timetable_entry_id_timetable_entries_id_fkey" FOREIGN KEY ("timetable_entry_id") REFERENCES "timetable_entries"("id");--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_absent_teacher_id_staff_id_fkey" FOREIGN KEY ("absent_teacher_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_substitute_teacher_id_staff_id_fkey" FOREIGN KEY ("substitute_teacher_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_timetable_id_timetables_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetables"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_teacher_id_staff_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id");--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_published_by_profiles_id_fkey" FOREIGN KEY ("published_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_copied_from_id_timetables_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "timetables"("id");--> statement-breakpoint
ALTER TABLE "learning_outcomes" ADD CONSTRAINT "learning_outcomes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "learning_outcomes" ADD CONSTRAINT "learning_outcomes_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teacher_id_staff_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_reviewed_by_profiles_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_copied_from_id_lesson_plans_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "lesson_plans"("id");--> statement-breakpoint
ALTER TABLE "scheme_weeks" ADD CONSTRAINT "scheme_weeks_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "scheme_weeks" ADD CONSTRAINT "scheme_weeks_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "scheme_weeks" ADD CONSTRAINT "scheme_weeks_scheme_id_schemes_of_work_id_fkey" FOREIGN KEY ("scheme_id") REFERENCES "schemes_of_work"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_term_id_terms_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_submitted_by_profiles_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "schemes_of_work" ADD CONSTRAINT "schemes_of_work_approved_by_profiles_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "syllabus_progress" ADD CONSTRAINT "syllabus_progress_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_parent_id_syllabus_units_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_record_id_attendance_records_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id");--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_attendance_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_marked_by_profiles_id_fkey" FOREIGN KEY ("marked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_taken_by_profiles_id_fkey" FOREIGN KEY ("taken_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "student_leave_requests" ADD CONSTRAINT "student_leave_requests_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "diary_acknowledgements" ADD CONSTRAINT "diary_acknowledgements_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "diary_acknowledgements" ADD CONSTRAINT "diary_acknowledgements_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "diary_acknowledgements" ADD CONSTRAINT "diary_acknowledgements_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "diary_acknowledgements" ADD CONSTRAINT "diary_acknowledgements_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "diary_acknowledgements" ADD CONSTRAINT "diary_acknowledgements_acknowledged_by_profiles_id_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_posted_by_staff_id_fkey" FOREIGN KEY ("posted_by") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_assigned_by_staff_id_fkey" FOREIGN KEY ("assigned_by") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homework_id_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homework"("id");--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_checked_by_profiles_id_fkey" FOREIGN KEY ("checked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_created_by_staff_id_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_section_subject_id_section_subjects_id_fkey" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id");--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_quiz_question_id_quiz_questions_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "quiz_questions"("id");--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_graded_by_profiles_id_fkey" FOREIGN KEY ("graded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id");--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id");--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_id_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_staff_id_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_resource_id_learning_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("id");--> statement-breakpoint
ALTER TABLE "resource_views" ADD CONSTRAINT "resource_views_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "exam_eligibility" ADD CONSTRAINT "exam_eligibility_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exam_eligibility" ADD CONSTRAINT "exam_eligibility_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exam_eligibility" ADD CONSTRAINT "exam_eligibility_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");--> statement-breakpoint
ALTER TABLE "exam_eligibility" ADD CONSTRAINT "exam_eligibility_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "exam_eligibility" ADD CONSTRAINT "exam_eligibility_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "exam_grades" ADD CONSTRAINT "exam_grades_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exam_grades" ADD CONSTRAINT "exam_grades_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exam_grades" ADD CONSTRAINT "exam_grades_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");--> statement-breakpoint
ALTER TABLE "exam_grades" ADD CONSTRAINT "exam_grades_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "exam_invigilation" ADD CONSTRAINT "exam_invigilation_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exam_invigilation" ADD CONSTRAINT "exam_invigilation_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exam_invigilation" ADD CONSTRAINT "exam_invigilation_exam_paper_id_exam_papers_id_fkey" FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers"("id");--> statement-breakpoint
ALTER TABLE "exam_invigilation" ADD CONSTRAINT "exam_invigilation_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "exam_invigilation" ADD CONSTRAINT "exam_invigilation_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_exam_paper_id_exam_papers_id_fkey" FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_marker_staff_id_staff_id_fkey" FOREIGN KEY ("marker_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_submitted_by_profiles_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_verified_by_profiles_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "exam_paper_sections" ADD CONSTRAINT "exam_paper_sections_locked_by_profiles_id_fkey" FOREIGN KEY ("locked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_question_paper_id_question_papers_id_fkey" FOREIGN KEY ("question_paper_id") REFERENCES "question_papers"("id");--> statement-breakpoint
ALTER TABLE "exam_seating" ADD CONSTRAINT "exam_seating_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exam_seating" ADD CONSTRAINT "exam_seating_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exam_seating" ADD CONSTRAINT "exam_seating_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");--> statement-breakpoint
ALTER TABLE "exam_seating" ADD CONSTRAINT "exam_seating_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "exam_seating" ADD CONSTRAINT "exam_seating_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_term_id_terms_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_exam_type_id_exam_types_id_fkey" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_grading_scheme_id_grading_schemes_id_fkey" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id");--> statement-breakpoint
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_mark_entry_id_mark_entries_id_fkey" FOREIGN KEY ("mark_entry_id") REFERENCES "mark_entries"("id");--> statement-breakpoint
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "mark_corrections" ADD CONSTRAINT "mark_corrections_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_exam_paper_section_id_exam_paper_sections_id_fkey" FOREIGN KEY ("exam_paper_section_id") REFERENCES "exam_paper_sections"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_exam_paper_id_exam_papers_id_fkey" FOREIGN KEY ("exam_paper_id") REFERENCES "exam_papers"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_entered_by_profiles_id_fkey" FOREIGN KEY ("entered_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "mark_question_scores" ADD CONSTRAINT "mark_question_scores_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "mark_question_scores" ADD CONSTRAINT "mark_question_scores_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "mark_question_scores" ADD CONSTRAINT "mark_question_scores_mark_entry_id_mark_entries_id_fkey" FOREIGN KEY ("mark_entry_id") REFERENCES "mark_entries"("id");--> statement-breakpoint
ALTER TABLE "mark_question_scores" ADD CONSTRAINT "mark_question_scores_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "mark_question_scores" ADD CONSTRAINT "mark_question_scores_outcome_id_learning_outcomes_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "learning_outcomes"("id");--> statement-breakpoint
ALTER TABLE "board_registrations" ADD CONSTRAINT "board_registrations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "board_registrations" ADD CONSTRAINT "board_registrations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "board_registrations" ADD CONSTRAINT "board_registrations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "board_registrations" ADD CONSTRAINT "board_registrations_board_id_boards_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id");--> statement-breakpoint
ALTER TABLE "board_registrations" ADD CONSTRAINT "board_registrations_subject_group_id_subject_groups_id_fkey" FOREIGN KEY ("subject_group_id") REFERENCES "subject_groups"("id");--> statement-breakpoint
ALTER TABLE "board_results" ADD CONSTRAINT "board_results_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "board_results" ADD CONSTRAINT "board_results_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "board_results" ADD CONSTRAINT "board_results_board_registration_id_board_registrations_id_fkey" FOREIGN KEY ("board_registration_id") REFERENCES "board_registrations"("id");--> statement-breakpoint
ALTER TABLE "board_results" ADD CONSTRAINT "board_results_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "board_results" ADD CONSTRAINT "board_results_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_areas" ADD CONSTRAINT "co_scholastic_areas_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ADD CONSTRAINT "co_scholastic_scores_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ADD CONSTRAINT "co_scholastic_scores_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ADD CONSTRAINT "co_scholastic_scores_result_set_id_result_sets_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "result_sets"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ADD CONSTRAINT "co_scholastic_scores_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ADD CONSTRAINT "co_scholastic_scores_area_id_co_scholastic_areas_id_fkey" FOREIGN KEY ("area_id") REFERENCES "co_scholastic_areas"("id");--> statement-breakpoint
ALTER TABLE "co_scholastic_scores" ADD CONSTRAINT "co_scholastic_scores_entered_by_profiles_id_fkey" FOREIGN KEY ("entered_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "report_card_templates" ADD CONSTRAINT "report_card_templates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_result_id_results_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_template_id_report_card_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_card_templates"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_acknowledged_by_profiles_id_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "result_policies" ADD CONSTRAINT "result_policies_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "result_set_components" ADD CONSTRAINT "result_set_components_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "result_set_components" ADD CONSTRAINT "result_set_components_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "result_set_components" ADD CONSTRAINT "result_set_components_result_set_id_result_sets_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "result_sets"("id");--> statement-breakpoint
ALTER TABLE "result_set_components" ADD CONSTRAINT "result_set_components_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_term_id_terms_id_fkey" FOREIGN KEY ("term_id") REFERENCES "terms"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_exam_id_exams_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_policy_id_result_policies_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "result_policies"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_grading_scheme_id_grading_schemes_id_fkey" FOREIGN KEY ("grading_scheme_id") REFERENCES "grading_schemes"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_template_id_report_card_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_card_templates"("id");--> statement-breakpoint
ALTER TABLE "result_sets" ADD CONSTRAINT "result_sets_published_by_profiles_id_fkey" FOREIGN KEY ("published_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "result_subjects" ADD CONSTRAINT "result_subjects_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "result_subjects" ADD CONSTRAINT "result_subjects_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "result_subjects" ADD CONSTRAINT "result_subjects_result_id_results_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id");--> statement-breakpoint
ALTER TABLE "result_subjects" ADD CONSTRAINT "result_subjects_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "result_subjects" ADD CONSTRAINT "result_subjects_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_result_set_id_result_sets_id_fkey" FOREIGN KEY ("result_set_id") REFERENCES "result_sets"("id");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "paper_blueprints" ADD CONSTRAINT "paper_blueprints_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "paper_blueprints" ADD CONSTRAINT "paper_blueprints_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "paper_blueprints" ADD CONSTRAINT "paper_blueprints_board_id_boards_id_fkey" FOREIGN KEY ("board_id") REFERENCES "boards"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_question_paper_id_question_papers_id_fkey" FOREIGN KEY ("question_paper_id") REFERENCES "question_papers"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_paper_section_id_paper_sections_id_fkey" FOREIGN KEY ("paper_section_id") REFERENCES "paper_sections"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_question_id_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_outcome_id_learning_outcomes_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "learning_outcomes"("id");--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_ai_accepted_by_profiles_id_fkey" FOREIGN KEY ("ai_accepted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "paper_sections" ADD CONSTRAINT "paper_sections_question_paper_id_question_papers_id_fkey" FOREIGN KEY ("question_paper_id") REFERENCES "question_papers"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_blueprint_id_paper_blueprints_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "paper_blueprints"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_created_by_staff_id_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_approved_by_profiles_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_key_document_id_generated_documents_id_fkey" FOREIGN KEY ("key_document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_grade_subject_id_grade_subjects_id_fkey" FOREIGN KEY ("grade_subject_id") REFERENCES "grade_subjects"("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_unit_id_syllabus_units_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_outcome_id_learning_outcomes_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "learning_outcomes"("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewed_by_profiles_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_staff_id_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "behaviour_categories" ADD CONSTRAINT "behaviour_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "behaviour_concerns" ADD CONSTRAINT "behaviour_concerns_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "behaviour_concerns" ADD CONSTRAINT "behaviour_concerns_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "behaviour_concerns" ADD CONSTRAINT "behaviour_concerns_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "behaviour_concerns" ADD CONSTRAINT "behaviour_concerns_owner_staff_id_staff_id_fkey" FOREIGN KEY ("owner_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "behaviour_record_notes" ADD CONSTRAINT "behaviour_record_notes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "behaviour_record_notes" ADD CONSTRAINT "behaviour_record_notes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "behaviour_record_notes" ADD CONSTRAINT "behaviour_record_notes_behaviour_record_id_behaviour_r_1f97aa6e" FOREIGN KEY ("behaviour_record_id") REFERENCES "behaviour_records"("id");--> statement-breakpoint
ALTER TABLE "behaviour_record_notes" ADD CONSTRAINT "behaviour_record_notes_author_id_profiles_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_category_id_behaviour_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "behaviour_categories"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_reported_by_staff_id_staff_id_fkey" FOREIGN KEY ("reported_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "behaviour_records" ADD CONSTRAINT "behaviour_records_concern_id_behaviour_concerns_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "behaviour_concerns"("id");--> statement-breakpoint
ALTER TABLE "concern_actions" ADD CONSTRAINT "concern_actions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "concern_actions" ADD CONSTRAINT "concern_actions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "concern_actions" ADD CONSTRAINT "concern_actions_concern_id_behaviour_concerns_id_fkey" FOREIGN KEY ("concern_id") REFERENCES "behaviour_concerns"("id");--> statement-breakpoint
ALTER TABLE "concern_actions" ADD CONSTRAINT "concern_actions_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "concern_actions" ADD CONSTRAINT "concern_actions_assigned_to_staff_id_staff_id_fkey" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "concern_actions" ADD CONSTRAINT "concern_actions_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_counsellor_staff_id_staff_id_fkey" FOREIGN KEY ("counsellor_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "counselling_notes" ADD CONSTRAINT "counselling_notes_referred_by_staff_id_staff_id_fkey" FOREIGN KEY ("referred_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_house_id_houses_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_behaviour_record_id_behaviour_records_id_fkey" FOREIGN KEY ("behaviour_record_id") REFERENCES "behaviour_records"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "house_points" ADD CONSTRAINT "house_points_awarded_by_profiles_id_fkey" FOREIGN KEY ("awarded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "houses" ADD CONSTRAINT "houses_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "houses" ADD CONSTRAINT "houses_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "houses" ADD CONSTRAINT "houses_house_master_staff_id_staff_id_fkey" FOREIGN KEY ("house_master_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
CREATE POLICY "bell_periods_staff" ON "bell_periods" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bell_periods"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bell_periods"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bell_periods_member_read" ON "bell_periods" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bell_periods"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "bell_periods_branch" ON "bell_periods" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "bell_periods"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "bell_periods"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "bell_schedules_staff" ON "bell_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bell_schedules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bell_schedules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bell_schedules_member_read" ON "bell_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("bell_schedules"."org_id" = (select app.org_id()) and "bell_schedules"."status" = 'active');--> statement-breakpoint
CREATE POLICY "bell_schedules_branch" ON "bell_schedules" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "bell_schedules"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "bell_schedules"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "substitutions_staff" ON "substitutions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("substitutions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("substitutions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "substitutions_branch" ON "substitutions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "substitutions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "substitutions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "teacher_availability_staff" ON "teacher_availability" AS PERMISSIVE FOR ALL TO "authenticated" USING ("teacher_availability"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("teacher_availability"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "teacher_availability_branch" ON "teacher_availability" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "teacher_availability"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "teacher_availability"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "timetable_entries_staff" ON "timetable_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("timetable_entries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("timetable_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "timetable_entries_member_read" ON "timetable_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("timetable_entries"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "timetable_entries_branch" ON "timetable_entries" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "timetable_entries"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "timetable_entries"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "timetables_staff" ON "timetables" AS PERMISSIVE FOR ALL TO "authenticated" USING ("timetables"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("timetables"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "timetables_member_read" ON "timetables" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("timetables"."org_id" = (select app.org_id()) and "timetables"."status" = 'published');--> statement-breakpoint
CREATE POLICY "timetables_branch" ON "timetables" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "timetables"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "timetables"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "learning_outcomes_staff" ON "learning_outcomes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("learning_outcomes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("learning_outcomes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "learning_outcomes_member_read" ON "learning_outcomes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("learning_outcomes"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "lesson_plans_staff" ON "lesson_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("lesson_plans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("lesson_plans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "lesson_plans_branch" ON "lesson_plans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "lesson_plans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "lesson_plans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "scheme_weeks_staff" ON "scheme_weeks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("scheme_weeks"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("scheme_weeks"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "scheme_weeks_branch" ON "scheme_weeks" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "scheme_weeks"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "scheme_weeks"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "schemes_of_work_staff" ON "schemes_of_work" AS PERMISSIVE FOR ALL TO "authenticated" USING ("schemes_of_work"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("schemes_of_work"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "schemes_of_work_branch" ON "schemes_of_work" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "schemes_of_work"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "schemes_of_work"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "syllabus_progress_staff" ON "syllabus_progress" AS PERMISSIVE FOR ALL TO "authenticated" USING ("syllabus_progress"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("syllabus_progress"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "syllabus_progress_branch" ON "syllabus_progress" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "syllabus_progress"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "syllabus_progress"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "syllabus_units_staff" ON "syllabus_units" AS PERMISSIVE FOR ALL TO "authenticated" USING ("syllabus_units"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("syllabus_units"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "syllabus_units_member_read" ON "syllabus_units" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("syllabus_units"."org_id" = (select app.org_id()) and "syllabus_units"."status" = 'active');--> statement-breakpoint
CREATE POLICY "attendance_corrections_staff" ON "attendance_corrections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("attendance_corrections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("attendance_corrections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "attendance_corrections_branch" ON "attendance_corrections" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "attendance_corrections"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "attendance_corrections"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "attendance_records_staff" ON "attendance_records" AS PERMISSIVE FOR ALL TO "authenticated" USING ("attendance_records"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("attendance_records"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "attendance_records_family_read" ON "attendance_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("attendance_records"."org_id" = (select app.org_id()) and "attendance_records"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "attendance_records_branch" ON "attendance_records" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "attendance_records"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "attendance_records"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "attendance_sessions_staff" ON "attendance_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("attendance_sessions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("attendance_sessions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "attendance_sessions_branch" ON "attendance_sessions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "attendance_sessions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "attendance_sessions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_leave_requests_staff" ON "student_leave_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_leave_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_leave_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_leave_requests_family_read" ON "student_leave_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_leave_requests"."org_id" = (select app.org_id()) and "student_leave_requests"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_leave_requests_family_insert" ON "student_leave_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("student_leave_requests"."org_id" = (select app.org_id()) and "student_leave_requests"."student_id" = any ((select app.student_ids())::uuid[]) and "student_leave_requests"."status" = 'pending');--> statement-breakpoint
CREATE POLICY "student_leave_requests_family_update" ON "student_leave_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("student_leave_requests"."org_id" = (select app.org_id()) and "student_leave_requests"."student_id" = any ((select app.student_ids())::uuid[]) and "student_leave_requests"."status" = 'pending') WITH CHECK ("student_leave_requests"."org_id" = (select app.org_id()) and "student_leave_requests"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_leave_requests_branch" ON "student_leave_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_leave_requests"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_leave_requests"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "diary_acknowledgements_staff" ON "diary_acknowledgements" AS PERMISSIVE FOR ALL TO "authenticated" USING ("diary_acknowledgements"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("diary_acknowledgements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "diary_acknowledgements_family_read" ON "diary_acknowledgements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("diary_acknowledgements"."org_id" = (select app.org_id()) and "diary_acknowledgements"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "diary_acknowledgements_family_insert" ON "diary_acknowledgements" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("diary_acknowledgements"."org_id" = (select app.org_id()) and "diary_acknowledgements"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "diary_acknowledgements_branch" ON "diary_acknowledgements" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "diary_acknowledgements"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "diary_acknowledgements"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "diary_entries_staff" ON "diary_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("diary_entries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("diary_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "diary_entries_member_read" ON "diary_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("diary_entries"."org_id" = (select app.org_id()) and "diary_entries"."status" = 'published');--> statement-breakpoint
CREATE POLICY "diary_entries_branch" ON "diary_entries" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "diary_entries"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "diary_entries"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "homework_staff" ON "homework" AS PERMISSIVE FOR ALL TO "authenticated" USING ("homework"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("homework"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "homework_member_read" ON "homework" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("homework"."org_id" = (select app.org_id()) and "homework"."status" in ('published', 'closed'));--> statement-breakpoint
CREATE POLICY "homework_branch" ON "homework" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "homework"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "homework"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "homework_submissions_staff" ON "homework_submissions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("homework_submissions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("homework_submissions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "homework_submissions_family_read" ON "homework_submissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("homework_submissions"."org_id" = (select app.org_id()) and "homework_submissions"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "homework_submissions_family_insert" ON "homework_submissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("homework_submissions"."org_id" = (select app.org_id()) and "homework_submissions"."student_id" = any ((select app.student_ids())::uuid[]) and "homework_submissions"."status" in ('pending', 'submitted', 'late'));--> statement-breakpoint
CREATE POLICY "homework_submissions_family_update" ON "homework_submissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("homework_submissions"."org_id" = (select app.org_id()) and "homework_submissions"."student_id" = any ((select app.student_ids())::uuid[]) and "homework_submissions"."status" in ('pending', 'submitted', 'late', 'returned')) WITH CHECK ("homework_submissions"."org_id" = (select app.org_id()) and "homework_submissions"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "homework_submissions_branch" ON "homework_submissions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "homework_submissions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "homework_submissions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "learning_resources_staff" ON "learning_resources" AS PERMISSIVE FOR ALL TO "authenticated" USING ("learning_resources"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("learning_resources"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "learning_resources_member_read" ON "learning_resources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("learning_resources"."org_id" = (select app.org_id()) and "learning_resources"."status" = 'published' and "learning_resources"."audience" = 'students');--> statement-breakpoint
CREATE POLICY "live_classes_staff" ON "live_classes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("live_classes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("live_classes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "live_classes_member_read" ON "live_classes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("live_classes"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "live_classes_branch" ON "live_classes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "live_classes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "live_classes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "quiz_answers_staff" ON "quiz_answers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("quiz_answers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("quiz_answers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "quiz_answers_family_read" ON "quiz_answers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("quiz_answers"."org_id" = (select app.org_id()) and "quiz_answers"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "quiz_answers_family_insert" ON "quiz_answers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("quiz_answers"."org_id" = (select app.org_id()) and "quiz_answers"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "quiz_answers_family_update" ON "quiz_answers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("quiz_answers"."org_id" = (select app.org_id()) and "quiz_answers"."student_id" = any ((select app.student_ids())::uuid[])) WITH CHECK ("quiz_answers"."org_id" = (select app.org_id()) and "quiz_answers"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "quiz_answers_branch" ON "quiz_answers" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "quiz_answers"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "quiz_answers"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "quiz_attempts_staff" ON "quiz_attempts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("quiz_attempts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("quiz_attempts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "quiz_attempts_family_read" ON "quiz_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("quiz_attempts"."org_id" = (select app.org_id()) and "quiz_attempts"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "quiz_attempts_family_insert" ON "quiz_attempts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("quiz_attempts"."org_id" = (select app.org_id()) and "quiz_attempts"."student_id" = any ((select app.student_ids())::uuid[]) and "quiz_attempts"."status" = 'in_progress');--> statement-breakpoint
CREATE POLICY "quiz_attempts_family_update" ON "quiz_attempts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("quiz_attempts"."org_id" = (select app.org_id()) and "quiz_attempts"."student_id" = any ((select app.student_ids())::uuid[]) and "quiz_attempts"."status" = 'in_progress') WITH CHECK ("quiz_attempts"."org_id" = (select app.org_id()) and "quiz_attempts"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "quiz_attempts_branch" ON "quiz_attempts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "quiz_attempts"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "quiz_attempts"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "quiz_questions_staff" ON "quiz_questions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("quiz_questions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("quiz_questions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "quiz_questions_branch" ON "quiz_questions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "quiz_questions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "quiz_questions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "quizzes_staff" ON "quizzes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("quizzes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("quizzes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "quizzes_member_read" ON "quizzes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("quizzes"."org_id" = (select app.org_id()) and "quizzes"."status" in ('published', 'closed'));--> statement-breakpoint
CREATE POLICY "quizzes_branch" ON "quizzes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "quizzes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "quizzes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "resource_views_staff_read" ON "resource_views" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("resource_views"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "resource_views_staff_insert" ON "resource_views" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("resource_views"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "resource_views_family_read" ON "resource_views" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("resource_views"."org_id" = (select app.org_id()) and "resource_views"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "resource_views_family_insert" ON "resource_views" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("resource_views"."org_id" = (select app.org_id()) and "resource_views"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "exam_eligibility_staff" ON "exam_eligibility" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_eligibility"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_eligibility"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exam_eligibility_family_read" ON "exam_eligibility" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exam_eligibility"."org_id" = (select app.org_id()) and "exam_eligibility"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "exam_eligibility_branch" ON "exam_eligibility" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exam_eligibility"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exam_eligibility"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "exam_grades_staff" ON "exam_grades" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_grades"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_grades"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exam_grades_member_read" ON "exam_grades" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exam_grades"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "exam_grades_branch" ON "exam_grades" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exam_grades"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exam_grades"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "exam_invigilation_staff" ON "exam_invigilation" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_invigilation"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_invigilation"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exam_invigilation_branch" ON "exam_invigilation" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exam_invigilation"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exam_invigilation"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "exam_paper_sections_staff" ON "exam_paper_sections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_paper_sections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_paper_sections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exam_paper_sections_branch" ON "exam_paper_sections" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exam_paper_sections"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exam_paper_sections"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "exam_papers_staff" ON "exam_papers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_papers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_papers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exam_papers_member_read" ON "exam_papers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exam_papers"."org_id" = (select app.org_id()) and "exam_papers"."status" in ('scheduled', 'conducted'));--> statement-breakpoint
CREATE POLICY "exam_papers_branch" ON "exam_papers" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exam_papers"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exam_papers"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "exam_seating_staff" ON "exam_seating" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_seating"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_seating"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exam_seating_family_read" ON "exam_seating" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exam_seating"."org_id" = (select app.org_id()) and "exam_seating"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "exam_seating_branch" ON "exam_seating" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exam_seating"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exam_seating"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "exam_types_staff" ON "exam_types" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exam_types"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exam_types"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exams_staff" ON "exams" AS PERMISSIVE FOR ALL TO "authenticated" USING ("exams"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("exams"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "exams_member_read" ON "exams" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("exams"."org_id" = (select app.org_id()) and "exams"."datesheet_published_at" is not null);--> statement-breakpoint
CREATE POLICY "exams_branch" ON "exams" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "exams"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "exams"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "mark_corrections_staff" ON "mark_corrections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("mark_corrections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("mark_corrections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "mark_corrections_branch" ON "mark_corrections" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "mark_corrections"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "mark_corrections"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "mark_entries_staff" ON "mark_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("mark_entries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("mark_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "mark_entries_branch" ON "mark_entries" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "mark_entries"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "mark_entries"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "mark_question_scores_staff" ON "mark_question_scores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("mark_question_scores"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("mark_question_scores"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "mark_question_scores_branch" ON "mark_question_scores" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "mark_question_scores"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "mark_question_scores"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "board_registrations_staff" ON "board_registrations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("board_registrations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("board_registrations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "board_registrations_family_read" ON "board_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("board_registrations"."org_id" = (select app.org_id()) and "board_registrations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "board_registrations_branch" ON "board_registrations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "board_registrations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "board_registrations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "board_results_staff" ON "board_results" AS PERMISSIVE FOR ALL TO "authenticated" USING ("board_results"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("board_results"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "board_results_family_read" ON "board_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("board_results"."org_id" = (select app.org_id()) and "board_results"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "board_results_branch" ON "board_results" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "board_results"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "board_results"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "co_scholastic_areas_staff" ON "co_scholastic_areas" AS PERMISSIVE FOR ALL TO "authenticated" USING ("co_scholastic_areas"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("co_scholastic_areas"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "co_scholastic_areas_member_read" ON "co_scholastic_areas" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("co_scholastic_areas"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "co_scholastic_scores_follows_set" ON "co_scholastic_scores" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((select app.is_staff()) or exists (select 1 from result_sets p where p.id = "co_scholastic_scores"."result_set_id"));--> statement-breakpoint
CREATE POLICY "co_scholastic_scores_staff" ON "co_scholastic_scores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("co_scholastic_scores"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("co_scholastic_scores"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "co_scholastic_scores_family_read" ON "co_scholastic_scores" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("co_scholastic_scores"."org_id" = (select app.org_id()) and "co_scholastic_scores"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "co_scholastic_scores_branch" ON "co_scholastic_scores" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "co_scholastic_scores"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "co_scholastic_scores"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "report_card_templates_staff" ON "report_card_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("report_card_templates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("report_card_templates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "report_cards_follows_result" ON "report_cards" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((select app.is_staff()) or exists (select 1 from results p where p.id = "report_cards"."result_id" and not p.is_withheld)) WITH CHECK ((select app.is_staff()) or exists (select 1 from results p where p.id = "report_cards"."result_id" and not p.is_withheld));--> statement-breakpoint
CREATE POLICY "report_cards_staff" ON "report_cards" AS PERMISSIVE FOR ALL TO "authenticated" USING ("report_cards"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("report_cards"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "report_cards_family_read" ON "report_cards" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("report_cards"."org_id" = (select app.org_id()) and "report_cards"."student_id" = any ((select app.student_ids())::uuid[]) and "report_cards"."status" = 'generated');--> statement-breakpoint
CREATE POLICY "report_cards_family_update" ON "report_cards" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("report_cards"."org_id" = (select app.org_id()) and "report_cards"."student_id" = any ((select app.student_ids())::uuid[]) and "report_cards"."status" = 'generated') WITH CHECK ("report_cards"."org_id" = (select app.org_id()) and "report_cards"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "report_cards_branch" ON "report_cards" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "report_cards"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "report_cards"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "result_policies_staff" ON "result_policies" AS PERMISSIVE FOR ALL TO "authenticated" USING ("result_policies"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("result_policies"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "result_set_components_staff" ON "result_set_components" AS PERMISSIVE FOR ALL TO "authenticated" USING ("result_set_components"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("result_set_components"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "result_set_components_branch" ON "result_set_components" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "result_set_components"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "result_set_components"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "result_sets_staff" ON "result_sets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("result_sets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("result_sets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "result_sets_member_read" ON "result_sets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("result_sets"."org_id" = (select app.org_id()) and "result_sets"."status" = 'published');--> statement-breakpoint
CREATE POLICY "result_sets_branch" ON "result_sets" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "result_sets"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "result_sets"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "result_subjects_follows_result" ON "result_subjects" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((select app.is_staff()) or exists (select 1 from results p where p.id = "result_subjects"."result_id" and not p.is_withheld));--> statement-breakpoint
CREATE POLICY "result_subjects_staff" ON "result_subjects" AS PERMISSIVE FOR ALL TO "authenticated" USING ("result_subjects"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("result_subjects"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "result_subjects_family_read" ON "result_subjects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("result_subjects"."org_id" = (select app.org_id()) and "result_subjects"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "result_subjects_branch" ON "result_subjects" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "result_subjects"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "result_subjects"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "results_follows_set" ON "results" AS RESTRICTIVE FOR SELECT TO "authenticated" USING ((select app.is_staff()) or exists (select 1 from result_sets p where p.id = "results"."result_set_id"));--> statement-breakpoint
CREATE POLICY "results_staff" ON "results" AS PERMISSIVE FOR ALL TO "authenticated" USING ("results"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("results"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "results_family_read" ON "results" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("results"."org_id" = (select app.org_id()) and "results"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "results_branch" ON "results" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "results"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "results"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "paper_blueprints_staff" ON "paper_blueprints" AS PERMISSIVE FOR ALL TO "authenticated" USING ("paper_blueprints"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("paper_blueprints"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "paper_questions_follows_paper" ON "paper_questions" AS RESTRICTIVE FOR ALL TO "authenticated" USING (exists (select 1 from question_papers p where p.id = "paper_questions"."question_paper_id")) WITH CHECK (exists (select 1 from question_papers p where p.id = "paper_questions"."question_paper_id"));--> statement-breakpoint
CREATE POLICY "paper_questions_staff" ON "paper_questions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("paper_questions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("paper_questions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "paper_questions_branch" ON "paper_questions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "paper_questions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "paper_questions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "paper_sections_follows_paper" ON "paper_sections" AS RESTRICTIVE FOR ALL TO "authenticated" USING (exists (select 1 from question_papers p where p.id = "paper_sections"."question_paper_id")) WITH CHECK (exists (select 1 from question_papers p where p.id = "paper_sections"."question_paper_id"));--> statement-breakpoint
CREATE POLICY "paper_sections_staff" ON "paper_sections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("paper_sections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("paper_sections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "paper_sections_branch" ON "paper_sections" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "paper_sections"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "paper_sections"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "question_papers_confidential" ON "question_papers" AS RESTRICTIVE FOR ALL TO "authenticated" USING (not ("question_papers"."is_confidential" and ("question_papers"."opens_on" is null or "question_papers"."opens_on" > (select app.today()))) or (select app.has_cap('papers')) or "question_papers"."created_by_staff_id" = (select app.staff_id())) WITH CHECK (not ("question_papers"."is_confidential" and ("question_papers"."opens_on" is null or "question_papers"."opens_on" > (select app.today()))) or (select app.has_cap('papers')) or "question_papers"."created_by_staff_id" = (select app.staff_id()));--> statement-breakpoint
CREATE POLICY "question_papers_staff" ON "question_papers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("question_papers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("question_papers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "question_papers_branch" ON "question_papers" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "question_papers"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "question_papers"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "questions_staff" ON "questions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("questions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("questions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "behaviour_categories_staff" ON "behaviour_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("behaviour_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("behaviour_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "behaviour_categories_member_read" ON "behaviour_categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("behaviour_categories"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "behaviour_concerns_staff" ON "behaviour_concerns" AS PERMISSIVE FOR ALL TO "authenticated" USING ("behaviour_concerns"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("behaviour_concerns"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "behaviour_concerns_branch" ON "behaviour_concerns" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "behaviour_concerns"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "behaviour_concerns"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "behaviour_record_notes_staff" ON "behaviour_record_notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("behaviour_record_notes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("behaviour_record_notes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "behaviour_record_notes_branch" ON "behaviour_record_notes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "behaviour_record_notes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "behaviour_record_notes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "behaviour_records_staff" ON "behaviour_records" AS PERMISSIVE FOR ALL TO "authenticated" USING ("behaviour_records"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("behaviour_records"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "behaviour_records_family_read" ON "behaviour_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("behaviour_records"."org_id" = (select app.org_id()) and "behaviour_records"."student_id" = any ((select app.student_ids())::uuid[]) and "behaviour_records"."status" in ('recorded', 'confirmed') and "behaviour_records"."visibility" = 'family');--> statement-breakpoint
CREATE POLICY "behaviour_records_branch" ON "behaviour_records" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "behaviour_records"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "behaviour_records"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "concern_actions_staff" ON "concern_actions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("concern_actions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("concern_actions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "concern_actions_family_read" ON "concern_actions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("concern_actions"."org_id" = (select app.org_id()) and "concern_actions"."student_id" = any ((select app.student_ids())::uuid[]) and "concern_actions"."share_with_family" = true);--> statement-breakpoint
CREATE POLICY "concern_actions_branch" ON "concern_actions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "concern_actions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "concern_actions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "counselling_notes_staff" ON "counselling_notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("counselling_notes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("counselling_notes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "counselling_notes_branch" ON "counselling_notes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "counselling_notes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "counselling_notes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "counselling_notes_cap" ON "counselling_notes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('counselling')) or "counselling_notes"."counsellor_staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('counselling')) or "counselling_notes"."counsellor_staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "house_points_staff_read" ON "house_points" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("house_points"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "house_points_staff_insert" ON "house_points" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("house_points"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "house_points_branch" ON "house_points" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "house_points"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "house_points"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "houses_staff" ON "houses" AS PERMISSIVE FOR ALL TO "authenticated" USING ("houses"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("houses"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "houses_member_read" ON "houses" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("houses"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "houses_branch" ON "houses" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "houses"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "houses"."branch_id" = any ((select app.branch_ids())::uuid[])));

-- Hand-written SQL for Wave 3 (packages/db/src/custom-sql/wave-3.sql)

-- bell_periods
alter table bell_periods add constraint bell_periods_no_overlap exclude using gist (bell_schedule_id with =, tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) with &&) where (deleted_at is null);

-- timetables
alter table timetables add constraint timetables_one_published exclude using gist (branch_id with =, shift_id with =, daterange(effective_from, effective_to, '[]') with &&) where (status = 'published' and deleted_at is null);

-- house_points
create view house_point_totals with (security_barrier = true) as
  select org_id, branch_id, house_id, academic_year_id, sum(points)::int as points
  from house_points
  where org_id = (select app.org_id())
  group by org_id, branch_id, house_id, academic_year_id;
revoke all on house_point_totals from public, anon, authenticated;
grant select on house_point_totals to authenticated;
comment on view house_point_totals is 'The points each house holds in a school year. What a family may see of house points: the totals, never who was given them or why.';
