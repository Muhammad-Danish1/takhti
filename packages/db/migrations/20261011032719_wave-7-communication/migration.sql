CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"guardian_id" uuid,
	"staff_id" uuid,
	"student_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "campaign_recipients_status_chk" CHECK ("status" in ('pending', 'queued', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "campaign_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "channel_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"channel" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"connection_id" uuid,
	"sender" text,
	"rate_per_minute" integer DEFAULT 60 NOT NULL,
	"quiet_from" time DEFAULT '21:00' NOT NULL,
	"quiet_to" time DEFAULT '08:00' NOT NULL,
	"credit_balance" bigint DEFAULT 0 NOT NULL,
	"low_credit_alert" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "channel_settings_channel_chk" CHECK ("channel" in ('in_app', 'push', 'whatsapp', 'sms', 'email')),
	CONSTRAINT "channel_settings_credit_balance_min" CHECK ("credit_balance" >= 0),
	CONSTRAINT "channel_settings_low_credit_alert_min" CHECK ("low_credit_alert" >= 0)
);
--> statement-breakpoint
ALTER TABLE "channel_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"channel" text NOT NULL,
	"from_address" text NOT NULL,
	"body" text,
	"media_file_id" uuid,
	"received_at" timestamp with time zone NOT NULL,
	"guardian_id" uuid,
	"provider_message_id" text NOT NULL,
	"handled_as" text,
	"chat_thread_id" uuid,
	CONSTRAINT "inbound_messages_channel_chk" CHECK ("channel" in ('whatsapp', 'sms')),
	CONSTRAINT "inbound_messages_handled_as_chk" CHECK ("handled_as" in ('stop', 'chatbot', 'chat_thread', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "inbound_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"branch_ids" uuid[] NOT NULL,
	"channels" text[] NOT NULL,
	"body_en" text,
	"body_ur" text,
	"whatsapp_template_id" uuid,
	"audience" jsonb NOT NULL,
	"is_urgent" boolean DEFAULT false NOT NULL,
	"send_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost" bigint DEFAULT 0 NOT NULL,
	"actual_cost" bigint DEFAULT 0 NOT NULL,
	"counts" jsonb DEFAULT '{}' NOT NULL,
	"approval_request_id" uuid,
	CONSTRAINT "message_campaigns_status_chk" CHECK ("status" in ('draft', 'pending_approval', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
	CONSTRAINT "message_campaigns_body_en_some" CHECK ("body_en" is not null or "body_ur" is not null),
	CONSTRAINT "message_campaigns_whatsapp_template_id_needed" CHECK (not ('whatsapp' = any ("channels")) or "whatsapp_template_id" is not null),
	CONSTRAINT "message_campaigns_estimated_cost_min" CHECK ("estimated_cost" >= 0),
	CONSTRAINT "message_campaigns_actual_cost_min" CHECK ("actual_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "message_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"delivery_id" uuid,
	"campaign_id" uuid,
	"note" text,
	CONSTRAINT "message_credit_ledger_channel_chk" CHECK ("channel" in ('sms', 'whatsapp')),
	CONSTRAINT "message_credit_ledger_kind_chk" CHECK ("kind" in ('purchase', 'usage', 'refund', 'adjustment')),
	CONSTRAINT "message_credit_ledger_balance_after_min" CHECK ("balance_after" >= 0)
);
--> statement-breakpoint
ALTER TABLE "message_credit_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"channel" text NOT NULL,
	"user_id" uuid,
	"guardian_id" uuid,
	"staff_id" uuid,
	"address" text NOT NULL,
	"event_key" text,
	"notification_id" uuid,
	"campaign_id" uuid,
	"locale" text NOT NULL,
	"body" text NOT NULL,
	"parts" integer DEFAULT 1 NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"skip_reason" text,
	"send_after" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error" text,
	"fallback_of_id" uuid,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "message_deliveries_channel_chk" CHECK ("channel" in ('push', 'whatsapp', 'sms', 'email')),
	CONSTRAINT "message_deliveries_locale_chk" CHECK ("locale" in ('en', 'ur')),
	CONSTRAINT "message_deliveries_status_chk" CHECK ("status" in ('queued', 'held', 'sending', 'sent', 'delivered', 'read', 'failed', 'skipped')),
	CONSTRAINT "message_deliveries_skip_reason_chk" CHECK ("skip_reason" in ('muted', 'no_address', 'opted_out', 'no_credit', 'template_not_approved', 'expired', 'duplicate', 'channel_off')),
	CONSTRAINT "message_deliveries_cost_min" CHECK ("cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "message_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "message_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	CONSTRAINT "message_opt_outs_channel_chk" CHECK ("channel" in ('whatsapp', 'sms', 'email')),
	CONSTRAINT "message_opt_outs_reason_chk" CHECK ("reason" in ('stop_reply', 'bounced', 'invalid', 'requested', 'complaint'))
);
--> statement-breakpoint
ALTER TABLE "message_opt_outs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"event_key" text NOT NULL,
	"audience" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"channels" text[] NOT NULL,
	"also_in_app" boolean DEFAULT true NOT NULL,
	"delay_minutes" integer DEFAULT 0 NOT NULL,
	"digest" text DEFAULT 'none' NOT NULL,
	CONSTRAINT "notification_rules_digest_chk" CHECK ("digest" in ('none', 'daily'))
);
--> statement-breakpoint
ALTER TABLE "notification_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"event_key" text NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"whatsapp_template_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "notification_templates_channel_chk" CHECK ("channel" in ('in_app', 'push', 'whatsapp', 'sms', 'email')),
	CONSTRAINT "notification_templates_locale_chk" CHECK ("locale" in ('en', 'ur'))
);
--> statement-breakpoint
ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"entity_type" text,
	"entity_id" uuid,
	"student_id" uuid,
	"is_urgent" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"dedupe_key" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_notification_prefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"channel" text NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_notification_prefs_channel_chk" CHECK ("channel" in ('in_app', 'push', 'whatsapp', 'sms', 'email'))
);
--> statement-breakpoint
ALTER TABLE "user_notification_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"category" text NOT NULL,
	"body" text NOT NULL,
	"variables" text[] NOT NULL,
	"buttons" jsonb DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider_template_id" text,
	"rejected_reason" text,
	CONSTRAINT "whatsapp_templates_language_chk" CHECK ("language" in ('en', 'ur')),
	CONSTRAINT "whatsapp_templates_category_chk" CHECK ("category" in ('utility', 'authentication', 'marketing')),
	CONSTRAINT "whatsapp_templates_status_chk" CHECK ("status" in ('draft', 'submitted', 'approved', 'rejected', 'paused'))
);
--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"until" date,
	"blocked_by" uuid NOT NULL,
	"lifted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chat_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text,
	"reply_to_id" uuid,
	"private_to_user_id" uuid,
	"sent_at" timestamp with time zone NOT NULL,
	"client_id" uuid NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"is_flagged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "chat_messages_kind_chk" CHECK ("kind" in ('text', 'image', 'file', 'voice', 'system')),
	CONSTRAINT "chat_messages_body_maxlen" CHECK (char_length("body") <= 4000),
	CONSTRAINT "chat_messages_body_needed" CHECK ("kind" <> 'text' or "body" is not null)
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"can_post" boolean DEFAULT true NOT NULL,
	"last_read_at" timestamp with time zone,
	"is_muted" boolean DEFAULT false NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "chat_participants_role_chk" CHECK ("role" in ('guardian', 'student', 'teacher', 'office', 'leader'))
);
--> statement-breakpoint
ALTER TABLE "chat_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_note" text,
	CONSTRAINT "chat_reports_reason_chk" CHECK ("reason" in ('abusive', 'inappropriate', 'spam', 'safety', 'other')),
	CONSTRAINT "chat_reports_status_chk" CHECK ("status" in ('open', 'upheld', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "chat_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"student_id" uuid,
	"section_id" uuid,
	"teacher_staff_id" uuid,
	"title" text,
	"replies" text DEFAULT 'open' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	CONSTRAINT "chat_threads_kind_chk" CHECK ("kind" in ('parent_teacher', 'parent_office', 'class_broadcast', 'staff_group', 'staff_direct')),
	CONSTRAINT "chat_threads_replies_chk" CHECK ("replies" in ('open', 'private_to_sender', 'off')),
	CONSTRAINT "chat_threads_status_chk" CHECK ("status" in ('open', 'closed')),
	CONSTRAINT "chat_threads_student_id_needed" CHECK ("kind" <> 'parent_teacher' or "student_id" is not null),
	CONSTRAINT "chat_threads_section_id_needed" CHECK ("kind" <> 'class_broadcast' or "section_id" is not null),
	CONSTRAINT "chat_threads_teacher_staff_id_needed" CHECK ("kind" <> 'parent_teacher' or "teacher_staff_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "chat_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ptm_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"teacher_staff_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"topic" text,
	"status" text DEFAULT 'booked' NOT NULL,
	"booked_by" uuid NOT NULL,
	"cancelled_reason" text,
	CONSTRAINT "ptm_bookings_mode_chk" CHECK ("mode" in ('in_person', 'online')),
	CONSTRAINT "ptm_bookings_status_chk" CHECK ("status" in ('booked', 'cancelled', 'attended', 'no_show'))
);
--> statement-breakpoint
ALTER TABLE "ptm_bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ptm_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"title" text NOT NULL,
	"held_on" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"mode" text DEFAULT 'in_person' NOT NULL,
	"slot_minutes" integer DEFAULT 10 NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"grade_ids" uuid[] NOT NULL,
	"booking_opens_at" timestamp with time zone NOT NULL,
	"booking_closes_at" timestamp with time zone NOT NULL,
	"who_is_booked" text DEFAULT 'class_teacher_only' NOT NULL,
	"instructions" text,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "ptm_events_mode_chk" CHECK ("mode" in ('in_person', 'online', 'both')),
	CONSTRAINT "ptm_events_who_is_booked_chk" CHECK ("who_is_booked" in ('class_teacher_only', 'all_teachers')),
	CONSTRAINT "ptm_events_status_chk" CHECK ("status" in ('draft', 'published', 'completed', 'cancelled')),
	CONSTRAINT "ptm_events_end_time_after" CHECK ("end_time" > "start_time"),
	CONSTRAINT "ptm_events_slot_minutes_range" CHECK ("slot_minutes" between 5 and 30)
);
--> statement-breakpoint
ALTER TABLE "ptm_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ptm_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"discussed" text,
	"agreed_actions" text,
	"follow_up_on" date,
	"share_with_family" boolean DEFAULT true NOT NULL,
	"private_note" text,
	"written_by" uuid NOT NULL,
	"parent_rating" integer,
	"parent_comment" text,
	CONSTRAINT "ptm_notes_parent_rating_range" CHECK ("parent_rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "ptm_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ptm_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"teacher_staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"room_id" uuid,
	"meeting_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "ptm_slots_status_chk" CHECK ("status" in ('open', 'booked', 'blocked'))
);
--> statement-breakpoint
ALTER TABLE "ptm_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "calendar_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "calendar_feeds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"consent" text DEFAULT 'not_needed' NOT NULL,
	"consent_by" uuid,
	"consent_at" timestamp with time zone,
	"fee_voucher_id" uuid,
	"emergency_phone" text,
	"note" text,
	"registered_by" uuid NOT NULL,
	CONSTRAINT "event_registrations_status_chk" CHECK ("status" in ('registered', 'waitlisted', 'cancelled', 'attended', 'absent')),
	CONSTRAINT "event_registrations_consent_chk" CHECK ("consent" in ('not_needed', 'pending', 'given', 'refused'))
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"duty" text
);
--> statement-breakpoint
ALTER TABLE "event_staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"title_ur" text,
	"description" text,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"branch_ids" uuid[] NOT NULL,
	"venue" text,
	"room_id" uuid,
	"audience" jsonb NOT NULL,
	"organiser_staff_id" uuid,
	"needs_registration" boolean DEFAULT false NOT NULL,
	"needs_consent" boolean DEFAULT false NOT NULL,
	"capacity" integer,
	"fee" bigint DEFAULT 0 NOT NULL,
	"fee_head_id" uuid,
	"registration_closes_at" timestamp with time zone,
	"show_on_website" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "events_kind_chk" CHECK ("kind" in ('academic', 'sports', 'cultural', 'religious', 'trip', 'competition', 'ceremony', 'meeting', 'workshop', 'other')),
	CONSTRAINT "events_status_chk" CHECK ("status" in ('draft', 'published', 'cancelled', 'completed')),
	CONSTRAINT "events_ends_at_from" CHECK ("ends_at" >= "starts_at"),
	CONSTRAINT "events_fee_min" CHECK ("fee" >= 0),
	CONSTRAINT "events_fee_head_id_needed" CHECK ("fee" = 0 or "fee_head_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notice_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"notice_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid,
	"read_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notice_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"title_ur" text,
	"body" text NOT NULL,
	"body_ur" text,
	"category" text DEFAULT 'general' NOT NULL,
	"audience" jsonb NOT NULL,
	"branch_ids" uuid[] NOT NULL,
	"publish_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"needs_acknowledgement" boolean DEFAULT false NOT NULL,
	"also_message" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"approval_request_id" uuid,
	CONSTRAINT "notices_category_chk" CHECK ("category" in ('general', 'academic', 'exam', 'fee', 'holiday', 'event', 'circular', 'emergency')),
	CONSTRAINT "notices_status_chk" CHECK ("status" in ('draft', 'pending_approval', 'scheduled', 'published', 'withdrawn', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "notices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "complaint_categories" (
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
	"kind" text DEFAULT 'complaint' NOT NULL,
	"owner_role" text NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"acknowledge_hours" integer DEFAULT 24 NOT NULL,
	"resolve_hours" integer DEFAULT 120 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "complaint_categories_kind_chk" CHECK ("kind" in ('complaint', 'suggestion', 'appreciation'))
);
--> statement-breakpoint
ALTER TABLE "complaint_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "complaint_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"complaint_id" uuid NOT NULL,
	"body" text,
	"author_id" uuid NOT NULL,
	"is_internal" boolean DEFAULT true NOT NULL,
	"status_from" text,
	"status_to" text
);
--> statement-breakpoint
ALTER TABLE "complaint_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"complaint_no" text NOT NULL,
	"category_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"raised_by" uuid,
	"raiser_kind" text NOT NULL,
	"raiser_name" text,
	"raiser_phone" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"student_id" uuid,
	"about_staff_id" uuid,
	"channel" text DEFAULT 'portal' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"owner_staff_id" uuid,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"acknowledge_by" timestamp with time zone NOT NULL,
	"resolve_by" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution" text,
	"satisfaction" integer,
	"recorded_by" uuid,
	CONSTRAINT "complaints_raiser_kind_chk" CHECK ("raiser_kind" in ('guardian', 'student', 'staff', 'other')),
	CONSTRAINT "complaints_channel_chk" CHECK ("channel" in ('portal', 'phone', 'in_person', 'letter', 'website', 'whatsapp')),
	CONSTRAINT "complaints_priority_chk" CHECK ("priority" in ('normal', 'high', 'urgent')),
	CONSTRAINT "complaints_status_chk" CHECK ("status" in ('open', 'acknowledged', 'in_progress', 'resolved', 'closed', 'reopened', 'rejected')),
	CONSTRAINT "complaints_satisfaction_range" CHECK ("satisfaction" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "complaints" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"about_staff_id" uuid,
	"value_number" numeric(4,1),
	"value_options" text[],
	"value_text" text
);
--> statement-breakpoint
ALTER TABLE "survey_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"survey_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "survey_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"survey_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"section_title" text,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"text_ur" text,
	"options" jsonb DEFAULT '[]' NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"about" text DEFAULT 'none' NOT NULL,
	CONSTRAINT "survey_questions_type_chk" CHECK ("type" in ('rating_5', 'score_10', 'yes_no', 'single_choice', 'multi_choice', 'short_text', 'long_text')),
	CONSTRAINT "survey_questions_about_chk" CHECK ("about" in ('none', 'class_teacher', 'each_subject_teacher'))
);
--> statement-breakpoint
ALTER TABLE "survey_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"survey_id" uuid NOT NULL,
	"respondent_id" uuid,
	"branch_id" uuid NOT NULL,
	"grade_id" uuid,
	"section_id" uuid,
	"respondent_kind" text NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "survey_responses_respondent_kind_chk" CHECK ("respondent_kind" in ('guardian', 'student', 'staff'))
);
--> statement-breakpoint
ALTER TABLE "survey_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"title_ur" text,
	"intro" text,
	"kind" text NOT NULL,
	"audience" jsonb NOT NULL,
	"branch_ids" uuid[] NOT NULL,
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"one_response_per" text DEFAULT 'person' NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"min_group_size" integer DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "surveys_kind_chk" CHECK ("kind" in ('parent_satisfaction', 'student_voice', 'staff_pulse', 'teacher_feedback', 'event_feedback', 'exit', 'custom')),
	CONSTRAINT "surveys_one_response_per_chk" CHECK ("one_response_per" in ('person', 'student')),
	CONSTRAINT "surveys_status_chk" CHECK ("status" in ('draft', 'open', 'closed', 'archived')),
	CONSTRAINT "surveys_closes_at_after" CHECK ("closes_at" > "opens_at")
);
--> statement-breakpoint
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"subject" text,
	"message" text NOT NULL,
	"branch_id" uuid,
	"page_slug" text,
	"status" text DEFAULT 'new' NOT NULL,
	"handled_by" uuid,
	"handled_note" text,
	CONSTRAINT "site_contact_messages_status_chk" CHECK ("status" in ('new', 'handled', 'spam')),
	CONSTRAINT "site_contact_messages_message_maxlen" CHECK (char_length("message") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "site_contact_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"file_id" uuid NOT NULL,
	"alt" text NOT NULL,
	"alt_ur" text,
	"album" text,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"has_consent" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"location" text NOT NULL,
	"items" jsonb NOT NULL,
	CONSTRAINT "site_menus_location_chk" CHECK ("location" in ('header', 'footer'))
);
--> statement-breakpoint
ALTER TABLE "site_menus" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"blocks" jsonb NOT NULL,
	"blocks_ur" jsonb,
	"seo_title" text,
	"seo_description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_blocks" jsonb,
	"published_at" timestamp with time zone,
	CONSTRAINT "site_pages_status_chk" CHECK ("status" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "site_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"title_ur" text,
	"excerpt" text,
	"body" text NOT NULL,
	"body_ur" text,
	"cover_file_id" uuid,
	"category" text DEFAULT 'news' NOT NULL,
	"branch_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"author_id" uuid NOT NULL,
	CONSTRAINT "site_posts_category_chk" CHECK ("category" in ('news', 'achievement', 'event', 'notice')),
	CONSTRAINT "site_posts_status_chk" CHECK ("status" in ('draft', 'scheduled', 'published', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "site_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	"custom_domain" text,
	"domain_status" text DEFAULT 'none' NOT NULL,
	"domain_token" text,
	"languages" text[] DEFAULT '{en}'::text[] NOT NULL,
	"default_language" text DEFAULT 'en' NOT NULL,
	"theme" jsonb DEFAULT '{}' NOT NULL,
	"tagline" text,
	"tagline_ur" text,
	"contact" jsonb DEFAULT '{}' NOT NULL,
	"social" jsonb DEFAULT '{}' NOT NULL,
	"seo" jsonb DEFAULT '{}' NOT NULL,
	"features" jsonb DEFAULT '{}' NOT NULL,
	"analytics_id" text,
	"footer_text" text,
	CONSTRAINT "site_settings_domain_status_chk" CHECK ("domain_status" in ('none', 'pending', 'verified', 'failed')),
	CONSTRAINT "site_settings_default_language_chk" CHECK ("default_language" in ('en', 'ur')),
	CONSTRAINT "site_settings_custom_domain_lower" CHECK ("custom_domain" = lower("custom_domain"))
);
--> statement-breakpoint
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_guardian_uq" ON "campaign_recipients" ("campaign_id","guardian_id") WHERE "deleted_at" is null and "guardian_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_staff_uq" ON "campaign_recipients" ("campaign_id","staff_id") WHERE "deleted_at" is null and "staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_campaign_user_uq" ON "campaign_recipients" ("campaign_id","user_id") WHERE "deleted_at" is null and "user_id" is not null;--> statement-breakpoint
CREATE INDEX "campaign_recipients_user_id_fk_idx" ON "campaign_recipients" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "campaign_recipients_guardian_id_fk_idx" ON "campaign_recipients" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "campaign_recipients_staff_id_fk_idx" ON "campaign_recipients" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_settings_channel_uq" ON "channel_settings" ("org_id","channel") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "channel_settings_connection_id_fk_idx" ON "channel_settings" ("connection_id") WHERE "connection_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_messages_channel_provider_message_uq" ON "inbound_messages" ("org_id","channel","provider_message_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "inbound_messages_media_file_id_fk_idx" ON "inbound_messages" ("media_file_id") WHERE "media_file_id" is not null;--> statement-breakpoint
CREATE INDEX "inbound_messages_guardian_id_fk_idx" ON "inbound_messages" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "inbound_messages_chat_thread_id_fk_idx" ON "inbound_messages" ("chat_thread_id") WHERE "chat_thread_id" is not null;--> statement-breakpoint
CREATE INDEX "message_campaigns_created_by_fk_idx" ON "message_campaigns" ("created_by");--> statement-breakpoint
CREATE INDEX "message_campaigns_whatsapp_template_id_fk_idx" ON "message_campaigns" ("whatsapp_template_id") WHERE "whatsapp_template_id" is not null;--> statement-breakpoint
CREATE INDEX "message_campaigns_approval_request_id_fk_idx" ON "message_campaigns" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "message_credit_ledger_delivery_id_fk_idx" ON "message_credit_ledger" ("delivery_id") WHERE "delivery_id" is not null;--> statement-breakpoint
CREATE INDEX "message_credit_ledger_campaign_id_fk_idx" ON "message_credit_ledger" ("campaign_id") WHERE "campaign_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "message_deliveries_dedupe_key_uq" ON "message_deliveries" ("org_id","dedupe_key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "message_deliveries_status_send_after_idx" ON "message_deliveries" ("org_id","status","send_after");--> statement-breakpoint
CREATE INDEX "message_deliveries_provider_provider_message_idx" ON "message_deliveries" ("org_id","provider","provider_message_id");--> statement-breakpoint
CREATE INDEX "message_deliveries_guardian_created_at_idx" ON "message_deliveries" ("org_id","guardian_id","created_at");--> statement-breakpoint
CREATE INDEX "message_deliveries_user_id_fk_idx" ON "message_deliveries" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "message_deliveries_guardian_id_fk_idx" ON "message_deliveries" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "message_deliveries_staff_id_fk_idx" ON "message_deliveries" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "message_deliveries_notification_id_fk_idx" ON "message_deliveries" ("notification_id") WHERE "notification_id" is not null;--> statement-breakpoint
CREATE INDEX "message_deliveries_campaign_id_fk_idx" ON "message_deliveries" ("campaign_id") WHERE "campaign_id" is not null;--> statement-breakpoint
CREATE INDEX "message_deliveries_fallback_of_id_fk_idx" ON "message_deliveries" ("fallback_of_id") WHERE "fallback_of_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "message_opt_outs_channel_address_uq" ON "message_opt_outs" ("org_id","channel","address") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_rules_event_key_audience_uq" ON "notification_rules" ("org_id","event_key","audience") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_event_key_channel_locale_uq" ON "notification_templates" ("org_id","event_key","channel","locale") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notification_templates_whatsapp_template_id_fk_idx" ON "notification_templates" ("whatsapp_template_id") WHERE "whatsapp_template_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key_uq" ON "notifications" ("org_id","dedupe_key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_user_read_at_created_at_idx" ON "notifications" ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_student_id_fk_idx" ON "notifications" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_prefs_user_category_channel_uq" ON "user_notification_prefs" ("org_id","user_id","category","channel") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "user_notification_prefs_user_id_fk_idx" ON "user_notification_prefs" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_templates_name_language_uq" ON "whatsapp_templates" ("org_id","name","language") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "chat_blocks_branch_id_fk_idx" ON "chat_blocks" ("branch_id");--> statement-breakpoint
CREATE INDEX "chat_blocks_user_id_fk_idx" ON "chat_blocks" ("user_id");--> statement-breakpoint
CREATE INDEX "chat_blocks_blocked_by_fk_idx" ON "chat_blocks" ("blocked_by");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_thread_client_uq" ON "chat_messages" ("thread_id","client_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "chat_messages_thread_sent_at_idx" ON "chat_messages" ("thread_id","sent_at");--> statement-breakpoint
CREATE INDEX "chat_messages_branch_id_fk_idx" ON "chat_messages" ("branch_id");--> statement-breakpoint
CREATE INDEX "chat_messages_sender_id_fk_idx" ON "chat_messages" ("sender_id");--> statement-breakpoint
CREATE INDEX "chat_messages_reply_to_id_fk_idx" ON "chat_messages" ("reply_to_id") WHERE "reply_to_id" is not null;--> statement-breakpoint
CREATE INDEX "chat_messages_private_to_user_id_fk_idx" ON "chat_messages" ("private_to_user_id") WHERE "private_to_user_id" is not null;--> statement-breakpoint
CREATE INDEX "chat_messages_removed_by_fk_idx" ON "chat_messages" ("removed_by") WHERE "removed_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_participants_thread_user_uq" ON "chat_participants" ("thread_id","user_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "chat_participants_user_left_at_idx" ON "chat_participants" ("user_id","left_at");--> statement-breakpoint
CREATE INDEX "chat_participants_branch_id_fk_idx" ON "chat_participants" ("branch_id");--> statement-breakpoint
CREATE INDEX "chat_reports_branch_id_fk_idx" ON "chat_reports" ("branch_id");--> statement-breakpoint
CREATE INDEX "chat_reports_message_id_fk_idx" ON "chat_reports" ("message_id");--> statement-breakpoint
CREATE INDEX "chat_reports_reported_by_fk_idx" ON "chat_reports" ("reported_by");--> statement-breakpoint
CREATE INDEX "chat_reports_handled_by_fk_idx" ON "chat_reports" ("handled_by") WHERE "handled_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_student_teacher_staff_uq" ON "chat_threads" ("student_id","teacher_staff_id") WHERE "deleted_at" is null and "kind" = 'parent_teacher' and "status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX "chat_threads_section_uq" ON "chat_threads" ("section_id") WHERE "deleted_at" is null and "kind" = 'class_broadcast';--> statement-breakpoint
CREATE INDEX "chat_threads_branch_last_message_at_idx" ON "chat_threads" ("org_id","branch_id","last_message_at");--> statement-breakpoint
CREATE INDEX "chat_threads_created_by_fk_idx" ON "chat_threads" ("created_by");--> statement-breakpoint
CREATE INDEX "chat_threads_branch_id_fk_idx" ON "chat_threads" ("branch_id");--> statement-breakpoint
CREATE INDEX "chat_threads_teacher_staff_id_fk_idx" ON "chat_threads" ("teacher_staff_id") WHERE "teacher_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ptm_bookings_slot_taken_uq" ON "ptm_bookings" ("slot_id") WHERE "status" in ('booked', 'attended') and "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ptm_bookings_event_student_teacher_uq" ON "ptm_bookings" ("event_id","student_id","teacher_staff_id") WHERE "status" <> 'cancelled' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ptm_bookings_branch_id_fk_idx" ON "ptm_bookings" ("branch_id");--> statement-breakpoint
CREATE INDEX "ptm_bookings_student_id_fk_idx" ON "ptm_bookings" ("student_id");--> statement-breakpoint
CREATE INDEX "ptm_bookings_guardian_id_fk_idx" ON "ptm_bookings" ("guardian_id");--> statement-breakpoint
CREATE INDEX "ptm_bookings_teacher_staff_id_fk_idx" ON "ptm_bookings" ("teacher_staff_id");--> statement-breakpoint
CREATE INDEX "ptm_bookings_booked_by_fk_idx" ON "ptm_bookings" ("booked_by");--> statement-breakpoint
CREATE INDEX "ptm_events_branch_id_fk_idx" ON "ptm_events" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ptm_notes_booking_uq" ON "ptm_notes" ("booking_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ptm_notes_branch_id_fk_idx" ON "ptm_notes" ("branch_id");--> statement-breakpoint
CREATE INDEX "ptm_notes_student_id_fk_idx" ON "ptm_notes" ("student_id");--> statement-breakpoint
CREATE INDEX "ptm_notes_written_by_fk_idx" ON "ptm_notes" ("written_by");--> statement-breakpoint
CREATE UNIQUE INDEX "ptm_slots_event_teacher_staff_starts_at_uq" ON "ptm_slots" ("event_id","teacher_staff_id","starts_at") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ptm_slots_branch_id_fk_idx" ON "ptm_slots" ("branch_id");--> statement-breakpoint
CREATE INDEX "ptm_slots_teacher_staff_id_fk_idx" ON "ptm_slots" ("teacher_staff_id");--> statement-breakpoint
CREATE INDEX "ptm_slots_room_id_fk_idx" ON "ptm_slots" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feeds_token_hash_uq" ON "calendar_feeds" ("token_hash");--> statement-breakpoint
CREATE INDEX "calendar_feeds_user_id_fk_idx" ON "calendar_feeds" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_student_uq" ON "event_registrations" ("event_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "event_registrations_branch_id_fk_idx" ON "event_registrations" ("branch_id");--> statement-breakpoint
CREATE INDEX "event_registrations_student_id_fk_idx" ON "event_registrations" ("student_id");--> statement-breakpoint
CREATE INDEX "event_registrations_consent_by_fk_idx" ON "event_registrations" ("consent_by") WHERE "consent_by" is not null;--> statement-breakpoint
CREATE INDEX "event_registrations_fee_voucher_id_fk_idx" ON "event_registrations" ("fee_voucher_id") WHERE "fee_voucher_id" is not null;--> statement-breakpoint
CREATE INDEX "event_registrations_registered_by_fk_idx" ON "event_registrations" ("registered_by");--> statement-breakpoint
CREATE UNIQUE INDEX "event_staff_event_staff_uq" ON "event_staff" ("event_id","staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "event_staff_branch_id_fk_idx" ON "event_staff" ("branch_id");--> statement-breakpoint
CREATE INDEX "event_staff_staff_id_fk_idx" ON "event_staff" ("staff_id");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" ("org_id","starts_at");--> statement-breakpoint
CREATE INDEX "events_room_id_fk_idx" ON "events" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "events_organiser_staff_id_fk_idx" ON "events" ("organiser_staff_id") WHERE "organiser_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "events_fee_head_id_fk_idx" ON "events" ("fee_head_id") WHERE "fee_head_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notice_recipients_notice_user_uq" ON "notice_recipients" ("notice_id","user_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notice_recipients_user_read_at_idx" ON "notice_recipients" ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notice_recipients_student_id_fk_idx" ON "notice_recipients" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "notices_status_published_at_idx" ON "notices" ("org_id","status","published_at");--> statement-breakpoint
CREATE INDEX "notices_created_by_fk_idx" ON "notices" ("created_by");--> statement-breakpoint
CREATE INDEX "notices_approval_request_id_fk_idx" ON "notices" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "complaint_categories_name_uq" ON "complaint_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "complaint_updates_branch_id_fk_idx" ON "complaint_updates" ("branch_id");--> statement-breakpoint
CREATE INDEX "complaint_updates_complaint_id_fk_idx" ON "complaint_updates" ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaint_updates_author_id_fk_idx" ON "complaint_updates" ("author_id");--> statement-breakpoint
CREATE INDEX "complaints_branch_status_resolve_by_idx" ON "complaints" ("org_id","branch_id","status","resolve_by");--> statement-breakpoint
CREATE INDEX "complaints_raised_by_idx" ON "complaints" ("org_id","raised_by");--> statement-breakpoint
CREATE INDEX "complaints_branch_id_fk_idx" ON "complaints" ("branch_id");--> statement-breakpoint
CREATE INDEX "complaints_category_id_fk_idx" ON "complaints" ("category_id");--> statement-breakpoint
CREATE INDEX "complaints_raised_by_fk_idx" ON "complaints" ("raised_by") WHERE "raised_by" is not null;--> statement-breakpoint
CREATE INDEX "complaints_student_id_fk_idx" ON "complaints" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "complaints_about_staff_id_fk_idx" ON "complaints" ("about_staff_id") WHERE "about_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "complaints_owner_staff_id_fk_idx" ON "complaints" ("owner_staff_id") WHERE "owner_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "complaints_recorded_by_fk_idx" ON "complaints" ("recorded_by") WHERE "recorded_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "survey_answers_response_question_about_staff_uq" ON "survey_answers" ("response_id","question_id",coalesce("about_staff_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "survey_answers_question_id_fk_idx" ON "survey_answers" ("question_id");--> statement-breakpoint
CREATE INDEX "survey_answers_about_staff_id_fk_idx" ON "survey_answers" ("about_staff_id") WHERE "about_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "survey_invitations_survey_user_student_uq" ON "survey_invitations" ("survey_id","user_id",coalesce("student_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "survey_invitations_user_id_fk_idx" ON "survey_invitations" ("user_id");--> statement-breakpoint
CREATE INDEX "survey_invitations_student_id_fk_idx" ON "survey_invitations" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "survey_questions_survey_id_fk_idx" ON "survey_questions" ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_id_fk_idx" ON "survey_responses" ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_responses_respondent_id_fk_idx" ON "survey_responses" ("respondent_id") WHERE "respondent_id" is not null;--> statement-breakpoint
CREATE INDEX "survey_responses_branch_id_fk_idx" ON "survey_responses" ("branch_id");--> statement-breakpoint
CREATE INDEX "survey_responses_grade_id_fk_idx" ON "survey_responses" ("grade_id") WHERE "grade_id" is not null;--> statement-breakpoint
CREATE INDEX "survey_responses_section_id_fk_idx" ON "survey_responses" ("section_id") WHERE "section_id" is not null;--> statement-breakpoint
CREATE INDEX "surveys_created_by_fk_idx" ON "surveys" ("created_by");--> statement-breakpoint
CREATE INDEX "site_contact_messages_branch_id_fk_idx" ON "site_contact_messages" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "site_contact_messages_handled_by_fk_idx" ON "site_contact_messages" ("handled_by") WHERE "handled_by" is not null;--> statement-breakpoint
CREATE INDEX "site_media_file_id_fk_idx" ON "site_media" ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_menus_location_uq" ON "site_menus" ("org_id","location") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_slug_uq" ON "site_pages" ("org_id","slug") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "site_pages_updated_by_fk_idx" ON "site_pages" ("updated_by") WHERE "updated_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "site_posts_slug_uq" ON "site_posts" ("org_id","slug") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "site_posts_status_published_at_idx" ON "site_posts" ("org_id","status","published_at");--> statement-breakpoint
CREATE INDEX "site_posts_cover_file_id_fk_idx" ON "site_posts" ("cover_file_id") WHERE "cover_file_id" is not null;--> statement-breakpoint
CREATE INDEX "site_posts_branch_id_fk_idx" ON "site_posts" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "site_posts_author_id_fk_idx" ON "site_posts" ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_settings_custom_domain_uq" ON "site_settings" ("custom_domain") WHERE "deleted_at" is null and "custom_domain" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "site_settings_org_uq" ON "site_settings" ("org_id") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_message_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "message_campaigns"("id");--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "channel_settings" ADD CONSTRAINT "channel_settings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "channel_settings" ADD CONSTRAINT "channel_settings_connection_id_integration_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id");--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_media_file_id_files_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_chat_thread_id_chat_threads_id_fkey" FOREIGN KEY ("chat_thread_id") REFERENCES "chat_threads"("id");--> statement-breakpoint
ALTER TABLE "message_campaigns" ADD CONSTRAINT "message_campaigns_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "message_campaigns" ADD CONSTRAINT "message_campaigns_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "message_campaigns" ADD CONSTRAINT "message_campaigns_whatsapp_template_id_whatsapp_templa_e1aae467" FOREIGN KEY ("whatsapp_template_id") REFERENCES "whatsapp_templates"("id");--> statement-breakpoint
ALTER TABLE "message_campaigns" ADD CONSTRAINT "message_campaigns_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "message_credit_ledger" ADD CONSTRAINT "message_credit_ledger_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "message_credit_ledger" ADD CONSTRAINT "message_credit_ledger_delivery_id_message_deliveries_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "message_deliveries"("id");--> statement-breakpoint
ALTER TABLE "message_credit_ledger" ADD CONSTRAINT "message_credit_ledger_campaign_id_message_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "message_campaigns"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_notification_id_notifications_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_campaign_id_message_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "message_campaigns"("id");--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_fallback_of_id_message_deliveries_id_fkey" FOREIGN KEY ("fallback_of_id") REFERENCES "message_deliveries"("id");--> statement-breakpoint
ALTER TABLE "message_opt_outs" ADD CONSTRAINT "message_opt_outs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_whatsapp_template_id_whatsapp_t_c18a3150" FOREIGN KEY ("whatsapp_template_id") REFERENCES "whatsapp_templates"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "user_notification_prefs" ADD CONSTRAINT "user_notification_prefs_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_by_profiles_id_fkey" FOREIGN KEY ("blocked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_profiles_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_chat_messages_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "chat_messages"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_private_to_user_id_profiles_id_fkey" FOREIGN KEY ("private_to_user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_removed_by_profiles_id_fkey" FOREIGN KEY ("removed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_thread_id_chat_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id");--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_message_id_chat_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id");--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reported_by_profiles_id_fkey" FOREIGN KEY ("reported_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_handled_by_profiles_id_fkey" FOREIGN KEY ("handled_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_teacher_staff_id_staff_id_fkey" FOREIGN KEY ("teacher_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_event_id_ptm_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "ptm_events"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_slot_id_ptm_slots_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "ptm_slots"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_teacher_staff_id_staff_id_fkey" FOREIGN KEY ("teacher_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "ptm_bookings" ADD CONSTRAINT "ptm_bookings_booked_by_profiles_id_fkey" FOREIGN KEY ("booked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ptm_events" ADD CONSTRAINT "ptm_events_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ptm_events" ADD CONSTRAINT "ptm_events_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ptm_notes" ADD CONSTRAINT "ptm_notes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ptm_notes" ADD CONSTRAINT "ptm_notes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ptm_notes" ADD CONSTRAINT "ptm_notes_booking_id_ptm_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "ptm_bookings"("id");--> statement-breakpoint
ALTER TABLE "ptm_notes" ADD CONSTRAINT "ptm_notes_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "ptm_notes" ADD CONSTRAINT "ptm_notes_written_by_profiles_id_fkey" FOREIGN KEY ("written_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_event_id_ptm_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "ptm_events"("id");--> statement-breakpoint
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_teacher_staff_id_staff_id_fkey" FOREIGN KEY ("teacher_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_consent_by_profiles_id_fkey" FOREIGN KEY ("consent_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_fee_voucher_id_fee_vouchers_id_fkey" FOREIGN KEY ("fee_voucher_id") REFERENCES "fee_vouchers"("id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_registered_by_profiles_id_fkey" FOREIGN KEY ("registered_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id");--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organiser_staff_id_staff_id_fkey" FOREIGN KEY ("organiser_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_fee_head_id_fee_heads_id_fkey" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id");--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_notice_id_notices_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id");--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "complaint_categories" ADD CONSTRAINT "complaint_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "complaint_updates" ADD CONSTRAINT "complaint_updates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "complaint_updates" ADD CONSTRAINT "complaint_updates_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "complaint_updates" ADD CONSTRAINT "complaint_updates_complaint_id_complaints_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id");--> statement-breakpoint
ALTER TABLE "complaint_updates" ADD CONSTRAINT "complaint_updates_author_id_profiles_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_category_id_complaint_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "complaint_categories"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_raised_by_profiles_id_fkey" FOREIGN KEY ("raised_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_about_staff_id_staff_id_fkey" FOREIGN KEY ("about_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_owner_staff_id_staff_id_fkey" FOREIGN KEY ("owner_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_recorded_by_profiles_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id");--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_survey_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id");--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_about_staff_id_staff_id_fkey" FOREIGN KEY ("about_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_survey_id_surveys_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id");--> statement-breakpoint
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_surveys_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_id_profiles_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id");--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_profiles_id_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "site_contact_messages" ADD CONSTRAINT "site_contact_messages_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "site_contact_messages" ADD CONSTRAINT "site_contact_messages_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "site_contact_messages" ADD CONSTRAINT "site_contact_messages_handled_by_profiles_id_fkey" FOREIGN KEY ("handled_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "site_media" ADD CONSTRAINT "site_media_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "site_media" ADD CONSTRAINT "site_media_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "site_menus" ADD CONSTRAINT "site_menus_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_updated_by_profiles_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "site_posts" ADD CONSTRAINT "site_posts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "site_posts" ADD CONSTRAINT "site_posts_cover_file_id_files_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "site_posts" ADD CONSTRAINT "site_posts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "site_posts" ADD CONSTRAINT "site_posts_author_id_profiles_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
CREATE POLICY "campaign_recipients_staff" ON "campaign_recipients" AS PERMISSIVE FOR ALL TO "authenticated" USING ("campaign_recipients"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("campaign_recipients"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "channel_settings_staff" ON "channel_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("channel_settings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("channel_settings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "inbound_messages_staff" ON "inbound_messages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("inbound_messages"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("inbound_messages"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "message_campaigns_staff" ON "message_campaigns" AS PERMISSIVE FOR ALL TO "authenticated" USING ("message_campaigns"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("message_campaigns"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "message_credit_ledger_staff_read" ON "message_credit_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("message_credit_ledger"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "message_deliveries_staff" ON "message_deliveries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("message_deliveries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("message_deliveries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "message_opt_outs_staff" ON "message_opt_outs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("message_opt_outs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("message_opt_outs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notification_rules_staff" ON "notification_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notification_rules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("notification_rules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notification_templates_staff" ON "notification_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notification_templates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("notification_templates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notifications_staff" ON "notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notifications"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("notifications"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notifications_self" ON "notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notifications"."org_id" = (select app.org_id()) and "notifications"."user_id" = (select app.user_id())) WITH CHECK ("notifications"."org_id" = (select app.org_id()) and "notifications"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "user_notification_prefs_staff" ON "user_notification_prefs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_notification_prefs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("user_notification_prefs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "user_notification_prefs_self" ON "user_notification_prefs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_notification_prefs"."org_id" = (select app.org_id()) and "user_notification_prefs"."user_id" = (select app.user_id())) WITH CHECK ("user_notification_prefs"."org_id" = (select app.org_id()) and "user_notification_prefs"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "whatsapp_templates_staff" ON "whatsapp_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("whatsapp_templates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("whatsapp_templates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "chat_blocks_staff" ON "chat_blocks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("chat_blocks"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("chat_blocks"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "chat_blocks_branch" ON "chat_blocks" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "chat_blocks"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "chat_blocks"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "chat_messages_participant_read" ON "chat_messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("chat_messages"."org_id" = (select app.org_id()) and exists (select 1 from chat_participants p where p.thread_id = "chat_messages"."thread_id" and p.user_id = (select app.user_id()) and p.left_at is null and p.deleted_at is null) and ("chat_messages"."private_to_user_id" is null or (select app.user_id()) in ("chat_messages"."sender_id", "chat_messages"."private_to_user_id")));--> statement-breakpoint
CREATE POLICY "chat_messages_participant_insert" ON "chat_messages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("chat_messages"."org_id" = (select app.org_id()) and "chat_messages"."sender_id" = (select app.user_id()) and exists (select 1 from chat_participants p where p.thread_id = "chat_messages"."thread_id" and p.user_id = (select app.user_id()) and p.left_at is null and p.deleted_at is null and p.can_post));--> statement-breakpoint
CREATE POLICY "chat_messages_branch" ON "chat_messages" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "chat_messages"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "chat_messages"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "chat_participants_branch" ON "chat_participants" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "chat_participants"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "chat_participants"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "chat_participants_self_read" ON "chat_participants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("chat_participants"."org_id" = (select app.org_id()) and "chat_participants"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "chat_reports_staff" ON "chat_reports" AS PERMISSIVE FOR ALL TO "authenticated" USING ("chat_reports"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("chat_reports"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "chat_reports_branch" ON "chat_reports" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "chat_reports"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "chat_reports"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "chat_threads_participant_read" ON "chat_threads" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("chat_threads"."org_id" = (select app.org_id()) and exists (select 1 from chat_participants p where p.thread_id = "chat_threads"."id" and p.user_id = (select app.user_id()) and p.left_at is null and p.deleted_at is null));--> statement-breakpoint
CREATE POLICY "chat_threads_branch" ON "chat_threads" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "chat_threads"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "chat_threads"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "ptm_bookings_staff" ON "ptm_bookings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ptm_bookings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ptm_bookings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ptm_bookings_family_read" ON "ptm_bookings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ptm_bookings"."org_id" = (select app.org_id()) and "ptm_bookings"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "ptm_bookings_family_insert" ON "ptm_bookings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("ptm_bookings"."org_id" = (select app.org_id()) and "ptm_bookings"."student_id" = any ((select app.student_ids())::uuid[]) and "ptm_bookings"."status" = 'booked');--> statement-breakpoint
CREATE POLICY "ptm_bookings_family_update" ON "ptm_bookings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("ptm_bookings"."org_id" = (select app.org_id()) and "ptm_bookings"."student_id" = any ((select app.student_ids())::uuid[]) and "ptm_bookings"."status" = 'booked') WITH CHECK ("ptm_bookings"."org_id" = (select app.org_id()) and "ptm_bookings"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "ptm_bookings_branch" ON "ptm_bookings" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_bookings"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_bookings"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "ptm_events_staff" ON "ptm_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ptm_events"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ptm_events"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ptm_events_member_read" ON "ptm_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ptm_events"."org_id" = (select app.org_id()) and "ptm_events"."status" in ('published', 'completed'));--> statement-breakpoint
CREATE POLICY "ptm_events_branch" ON "ptm_events" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_events"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_events"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "ptm_notes_staff" ON "ptm_notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ptm_notes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ptm_notes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ptm_notes_family_read" ON "ptm_notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ptm_notes"."org_id" = (select app.org_id()) and "ptm_notes"."student_id" = any ((select app.student_ids())::uuid[]) and "ptm_notes"."share_with_family" = true);--> statement-breakpoint
CREATE POLICY "ptm_notes_branch" ON "ptm_notes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_notes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_notes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "ptm_slots_staff" ON "ptm_slots" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ptm_slots"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ptm_slots"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ptm_slots_member_read" ON "ptm_slots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ptm_slots"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "ptm_slots_branch" ON "ptm_slots" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_slots"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "ptm_slots"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "calendar_feeds_staff" ON "calendar_feeds" AS PERMISSIVE FOR ALL TO "authenticated" USING ("calendar_feeds"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("calendar_feeds"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "calendar_feeds_self" ON "calendar_feeds" AS PERMISSIVE FOR ALL TO "authenticated" USING ("calendar_feeds"."org_id" = (select app.org_id()) and "calendar_feeds"."user_id" = (select app.user_id())) WITH CHECK ("calendar_feeds"."org_id" = (select app.org_id()) and "calendar_feeds"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "event_registrations_staff" ON "event_registrations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("event_registrations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("event_registrations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "event_registrations_family_read" ON "event_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event_registrations"."org_id" = (select app.org_id()) and "event_registrations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "event_registrations_family_insert" ON "event_registrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("event_registrations"."org_id" = (select app.org_id()) and "event_registrations"."student_id" = any ((select app.student_ids())::uuid[]) and "event_registrations"."status" in ('registered', 'waitlisted'));--> statement-breakpoint
CREATE POLICY "event_registrations_family_update" ON "event_registrations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("event_registrations"."org_id" = (select app.org_id()) and "event_registrations"."student_id" = any ((select app.student_ids())::uuid[]) and "event_registrations"."status" in ('registered', 'waitlisted')) WITH CHECK ("event_registrations"."org_id" = (select app.org_id()) and "event_registrations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "event_registrations_branch" ON "event_registrations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "event_registrations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "event_registrations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "event_staff_staff" ON "event_staff" AS PERMISSIVE FOR ALL TO "authenticated" USING ("event_staff"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("event_staff"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "event_staff_branch" ON "event_staff" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "event_staff"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "event_staff"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "events_staff" ON "events" AS PERMISSIVE FOR ALL TO "authenticated" USING ("events"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("events"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notice_recipients_staff" ON "notice_recipients" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notice_recipients"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("notice_recipients"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "notice_recipients_self" ON "notice_recipients" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notice_recipients"."org_id" = (select app.org_id()) and "notice_recipients"."user_id" = (select app.user_id())) WITH CHECK ("notice_recipients"."org_id" = (select app.org_id()) and "notice_recipients"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "notices_staff" ON "notices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("notices"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("notices"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "complaint_categories_staff" ON "complaint_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("complaint_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("complaint_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "complaint_updates_staff_read" ON "complaint_updates" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("complaint_updates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "complaint_updates_staff_insert" ON "complaint_updates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("complaint_updates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "complaint_updates_branch" ON "complaint_updates" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "complaint_updates"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "complaint_updates"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "complaints_staff" ON "complaints" AS PERMISSIVE FOR ALL TO "authenticated" USING ("complaints"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("complaints"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "complaints_branch" ON "complaints" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "complaints"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "complaints"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "complaints_self_read" ON "complaints" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("complaints"."org_id" = (select app.org_id()) and "complaints"."raised_by" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "survey_answers_closed" ON "survey_answers" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "survey_invitations_staff" ON "survey_invitations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("survey_invitations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("survey_invitations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "survey_invitations_self" ON "survey_invitations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("survey_invitations"."org_id" = (select app.org_id()) and "survey_invitations"."user_id" = (select app.user_id())) WITH CHECK ("survey_invitations"."org_id" = (select app.org_id()) and "survey_invitations"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "survey_questions_staff" ON "survey_questions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("survey_questions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("survey_questions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "survey_responses_closed" ON "survey_responses" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "surveys_staff" ON "surveys" AS PERMISSIVE FOR ALL TO "authenticated" USING ("surveys"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("surveys"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "site_contact_messages_staff" ON "site_contact_messages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("site_contact_messages"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("site_contact_messages"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "site_media_staff" ON "site_media" AS PERMISSIVE FOR ALL TO "authenticated" USING ("site_media"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("site_media"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "site_menus_staff" ON "site_menus" AS PERMISSIVE FOR ALL TO "authenticated" USING ("site_menus"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("site_menus"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "site_pages_staff" ON "site_pages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("site_pages"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("site_pages"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "site_posts_staff" ON "site_posts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("site_posts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("site_posts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "site_settings_staff" ON "site_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("site_settings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("site_settings"."org_id" = (select app.org_id()) and (select app.is_staff()));