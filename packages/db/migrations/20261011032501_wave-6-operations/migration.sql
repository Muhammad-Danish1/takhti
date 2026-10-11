CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"licence_no" text NOT NULL,
	"licence_category" text NOT NULL,
	"licence_expires_on" date NOT NULL,
	"medical_valid_until" date,
	"police_verified_on" date,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fuel_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"filled_on" date NOT NULL,
	"litres" numeric(7,2) NOT NULL,
	"amount" bigint NOT NULL,
	"odometer_km" integer NOT NULL,
	"station" text,
	"filled_by_staff_id" uuid,
	"receipt_file_id" uuid,
	"expense_id" uuid,
	"km_per_litre" numeric(6,2),
	CONSTRAINT "fuel_logs_litres_pos" CHECK ("litres" > 0),
	CONSTRAINT "fuel_logs_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "fuel_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"sort_order" integer NOT NULL,
	"pickup_time" time,
	"drop_time" time,
	"latitude" numeric(9,6),
	"longitude" numeric(9,6),
	"landmark" text,
	"monthly_fee" bigint NOT NULL,
	CONSTRAINT "route_stops_monthly_fee_min" CHECK ("monthly_fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "route_stops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_assignments" (
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
	"route_id" uuid NOT NULL,
	"stop_id" uuid NOT NULL,
	"direction" text DEFAULT 'both' NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date,
	"monthly_fee" bigint NOT NULL,
	"fee_item_id" uuid,
	"handover_note" text,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "transport_assignments_direction_chk" CHECK ("direction" in ('both', 'pickup_only', 'drop_only')),
	CONSTRAINT "transport_assignments_status_chk" CHECK ("status" in ('active', 'ended')),
	CONSTRAINT "transport_assignments_monthly_fee_min" CHECK ("monthly_fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "transport_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_requests" (
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
	"stop_id" uuid,
	"direction" text DEFAULT 'both' NOT NULL,
	"from_date" date NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decision_note" text,
	CONSTRAINT "transport_requests_kind_chk" CHECK ("kind" in ('start', 'change_stop', 'stop')),
	CONSTRAINT "transport_requests_direction_chk" CHECK ("direction" in ('both', 'pickup_only', 'drop_only')),
	CONSTRAINT "transport_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "transport_requests_stop_id_needed" CHECK ("kind" not in ('start', 'change_stop') or "stop_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "transport_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transport_routes" (
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
	"code" text NOT NULL,
	"shift_id" uuid,
	"vehicle_id" uuid,
	"driver_staff_id" uuid,
	"attendant_staff_id" uuid,
	"pickup_start_time" time,
	"drop_start_time" time,
	"distance_km" numeric(6,1),
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "transport_routes_status_chk" CHECK ("status" in ('active', 'inactive'))
);
--> statement-breakpoint
ALTER TABLE "transport_routes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trip_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"trip_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"stop_id" uuid,
	"event" text NOT NULL,
	"happened_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid NOT NULL,
	"source" text DEFAULT 'app' NOT NULL,
	"handed_to" text,
	CONSTRAINT "trip_events_event_chk" CHECK ("event" in ('boarded', 'dropped', 'no_show', 'not_riding')),
	CONSTRAINT "trip_events_source_chk" CHECK ("source" in ('app', 'card_scan', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "trip_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"trip_date" date NOT NULL,
	"direction" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_staff_id" uuid NOT NULL,
	"attendant_staff_id" uuid,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"start_odometer_km" integer,
	"end_odometer_km" integer,
	"expected_count" integer DEFAULT 0 NOT NULL,
	"note" text,
	CONSTRAINT "trips_direction_chk" CHECK ("direction" in ('pickup', 'drop')),
	CONSTRAINT "trips_status_chk" CHECK ("status" in ('scheduled', 'running', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"trip_id" uuid,
	"recorded_at" timestamp with time zone NOT NULL,
	"latitude" numeric(9,6) NOT NULL,
	"longitude" numeric(9,6) NOT NULL,
	"speed_kmh" integer,
	"source" text NOT NULL,
	CONSTRAINT "vehicle_locations_source_chk" CHECK ("source" in ('tracker', 'phone'))
);
--> statement-breakpoint
ALTER TABLE "vehicle_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"done_on" date NOT NULL,
	"odometer_km" integer,
	"description" text NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	"vendor_id" uuid,
	"expense_id" uuid,
	"next_due_on" date,
	"next_due_km" integer,
	CONSTRAINT "vehicle_maintenance_kind_chk" CHECK ("kind" in ('service', 'repair', 'tyres', 'battery', 'inspection', 'accident', 'other')),
	CONSTRAINT "vehicle_maintenance_cost_min" CHECK ("cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"registration_no" text NOT NULL,
	"name" text,
	"kind" text NOT NULL,
	"make_model" text,
	"seats" integer NOT NULL,
	"ownership" text DEFAULT 'owned' NOT NULL,
	"contractor_vendor_id" uuid,
	"fitness_expires_on" date,
	"insurance_expires_on" date,
	"route_permit_expires_on" date,
	"token_tax_paid_until" date,
	"tracker_id" text,
	"odometer_km" integer DEFAULT 0 NOT NULL,
	"last_latitude" numeric(9,6),
	"last_longitude" numeric(9,6),
	"last_seen_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "vehicles_kind_chk" CHECK ("kind" in ('bus', 'coaster', 'van', 'car', 'rickshaw')),
	CONSTRAINT "vehicles_ownership_chk" CHECK ("ownership" in ('owned', 'contracted')),
	CONSTRAINT "vehicles_status_chk" CHECK ("status" in ('active', 'in_workshop', 'retired')),
	CONSTRAINT "vehicles_seats_pos" CHECK ("seats" > 0),
	CONSTRAINT "vehicles_contractor_vendor_id_needed" CHECK ("ownership" <> 'contracted' or "contractor_vendor_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_categories" (
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
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"accession_no" text NOT NULL,
	"barcode" text NOT NULL,
	"shelf" text,
	"condition" text DEFAULT 'good' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"acquired_on" date,
	"source" text DEFAULT 'purchase' NOT NULL,
	"price" bigint,
	"withdrawn_reason" text,
	CONSTRAINT "library_copies_condition_chk" CHECK ("condition" in ('new', 'good', 'worn', 'damaged')),
	CONSTRAINT "library_copies_status_chk" CHECK ("status" in ('available', 'on_loan', 'on_hold', 'in_repair', 'lost', 'withdrawn')),
	CONSTRAINT "library_copies_source_chk" CHECK ("source" in ('purchase', 'donation', 'transfer')),
	CONSTRAINT "library_copies_price_min" CHECK ("price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "library_copies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_fines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"fee_voucher_id" uuid,
	"paid_on" date,
	"received_by" uuid,
	"waived_by" uuid,
	"waive_reason" text,
	CONSTRAINT "library_fines_kind_chk" CHECK ("kind" in ('overdue', 'lost', 'damage')),
	CONSTRAINT "library_fines_status_chk" CHECK ("status" in ('due', 'paid', 'billed', 'waived')),
	CONSTRAINT "library_fines_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "library_fines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_items" (
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
	"subtitle" text,
	"authors" text[] DEFAULT '{}'::text[] NOT NULL,
	"publisher" text,
	"edition" text,
	"publish_year" integer,
	"isbn" text,
	"language" text DEFAULT 'en' NOT NULL,
	"kind" text DEFAULT 'book' NOT NULL,
	"category_id" uuid,
	"call_number" text,
	"grade_from" integer,
	"grade_to" integer,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"summary" text,
	"cover_file_id" uuid,
	"digital_file_id" uuid,
	"is_reference_only" boolean DEFAULT false NOT NULL,
	"price" bigint,
	CONSTRAINT "library_items_language_chk" CHECK ("language" in ('en', 'ur', 'ar', 'other')),
	CONSTRAINT "library_items_kind_chk" CHECK ("kind" in ('book', 'textbook', 'reference', 'magazine', 'newspaper', 'audio_visual', 'digital')),
	CONSTRAINT "library_items_price_min" CHECK ("price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "library_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"member_kind" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"issued_on" date NOT NULL,
	"due_on" date NOT NULL,
	"returned_on" date,
	"renewals" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'on_loan' NOT NULL,
	"issued_by" uuid NOT NULL,
	"returned_to" uuid,
	"return_condition" text,
	"note" text,
	CONSTRAINT "library_loans_member_kind_chk" CHECK ("member_kind" in ('student', 'staff')),
	CONSTRAINT "library_loans_status_chk" CHECK ("status" in ('on_loan', 'returned', 'lost')),
	CONSTRAINT "library_loans_return_condition_chk" CHECK ("return_condition" in ('good', 'worn', 'damaged'))
);
--> statement-breakpoint
ALTER TABLE "library_loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"member_kind" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"card_no" text,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	CONSTRAINT "library_members_member_kind_chk" CHECK ("member_kind" in ('student', 'staff')),
	CONSTRAINT "library_members_student_id_needed" CHECK ("member_kind" <> 'student' or "student_id" is not null),
	CONSTRAINT "library_members_staff_id_needed" CHECK ("member_kind" <> 'staff' or "staff_id" is not null),
	CONSTRAINT "library_members_blocked_reason_needed" CHECK (not "is_blocked" or "blocked_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "library_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"member_kind" text NOT NULL,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"max_items" integer NOT NULL,
	"loan_days" integer NOT NULL,
	"renewals_max" integer DEFAULT 1 NOT NULL,
	"fine_per_day" bigint DEFAULT 0 NOT NULL,
	"fine_cap" bigint,
	"grace_days" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "library_policies_member_kind_chk" CHECK ("member_kind" in ('student', 'staff')),
	CONSTRAINT "library_policies_max_items_min" CHECK ("max_items" >= 1),
	CONSTRAINT "library_policies_loan_days_min" CHECK ("loan_days" >= 1),
	CONSTRAINT "library_policies_fine_per_day_min" CHECK ("fine_per_day" >= 0),
	CONSTRAINT "library_policies_fine_cap_min" CHECK ("fine_cap" >= 0)
);
--> statement-breakpoint
ALTER TABLE "library_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"member_kind" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"reserved_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"copy_id" uuid,
	"ready_until" date,
	CONSTRAINT "library_reservations_member_kind_chk" CHECK ("member_kind" in ('student', 'staff')),
	CONSTRAINT "library_reservations_status_chk" CHECK ("status" in ('waiting', 'ready', 'collected', 'cancelled', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "library_reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_stock_check_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"stock_check_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"scanned_at" timestamp with time zone NOT NULL,
	"scanned_by" uuid NOT NULL,
	"shelf_found" text
);
--> statement-breakpoint
ALTER TABLE "library_stock_check_scans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "library_stock_checks" (
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
	"started_on" date NOT NULL,
	"finished_on" date,
	"status" text DEFAULT 'open' NOT NULL,
	"copies_expected" integer DEFAULT 0 NOT NULL,
	"copies_found" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "library_stock_checks_status_chk" CHECK ("status" in ('open', 'review', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "library_stock_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"staff_id" uuid,
	"room_id" uuid,
	"from_date" date NOT NULL,
	"to_date" date,
	"condition_at_handover" text,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "asset_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asset_audits" (
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
	"started_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"scans" jsonb DEFAULT '[]' NOT NULL,
	CONSTRAINT "asset_audits_status_chk" CHECK ("status" in ('open', 'review', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "asset_audits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asset_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"useful_life_months" integer,
	"declining_percent" numeric(5,2),
	"asset_account_id" uuid,
	CONSTRAINT "asset_categories_depreciation_method_chk" CHECK ("depreciation_method" in ('none', 'straight_line', 'declining_balance'))
);
--> statement-breakpoint
ALTER TABLE "asset_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "asset_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"done_on" date NOT NULL,
	"description" text NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	"vendor_id" uuid,
	"ticket_id" uuid,
	"expense_id" uuid,
	"next_due_on" date,
	CONSTRAINT "asset_maintenance_kind_chk" CHECK ("kind" in ('repair', 'service', 'inspection', 'upgrade')),
	CONSTRAINT "asset_maintenance_cost_min" CHECK ("cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"asset_no" text NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"description" text,
	"serial_no" text,
	"make_model" text,
	"purchased_on" date,
	"cost" bigint DEFAULT 0 NOT NULL,
	"salvage_value" bigint DEFAULT 0 NOT NULL,
	"vendor_id" uuid,
	"vendor_bill_id" uuid,
	"room_id" uuid,
	"custodian_staff_id" uuid,
	"condition" text DEFAULT 'good' NOT NULL,
	"status" text DEFAULT 'in_use' NOT NULL,
	"warranty_until" date,
	"depreciation_starts_on" date,
	"accumulated_depreciation" bigint DEFAULT 0 NOT NULL,
	"book_value" bigint GENERATED ALWAYS AS ("assets"."cost" - "assets"."accumulated_depreciation") STORED,
	"disposed_on" date,
	"disposal_amount" bigint,
	"disposal_reason" text,
	CONSTRAINT "assets_condition_chk" CHECK ("condition" in ('new', 'good', 'fair', 'poor', 'unusable')),
	CONSTRAINT "assets_status_chk" CHECK ("status" in ('in_use', 'in_store', 'under_repair', 'disposed', 'lost')),
	CONSTRAINT "assets_cost_min" CHECK ("cost" >= 0),
	CONSTRAINT "assets_salvage_value_min" CHECK ("salvage_value" >= 0),
	CONSTRAINT "assets_accumulated_depreciation_min" CHECK ("accumulated_depreciation" >= 0),
	CONSTRAINT "assets_disposal_amount_min" CHECK ("disposal_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "depreciation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"fiscal_period_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"lines" jsonb DEFAULT '[]' NOT NULL,
	"posted_by" uuid,
	CONSTRAINT "depreciation_runs_status_chk" CHECK ("status" in ('draft', 'posted', 'reversed')),
	CONSTRAINT "depreciation_runs_total_min" CHECK ("total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "depreciation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inventory_categories" (
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
	"parent_id" uuid,
	CONSTRAINT "inventory_categories_kind_chk" CHECK ("kind" in ('stationery', 'cleaning', 'lab', 'sports', 'uniform', 'books', 'food', 'it_supplies', 'medical', 'other'))
);
--> statement-breakpoint
ALTER TABLE "inventory_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text,
	"category_id" uuid NOT NULL,
	"unit" text NOT NULL,
	"barcode" text,
	"variant_group" text,
	"variant_label" text,
	"reorder_level" numeric(12,3) DEFAULT '0' NOT NULL,
	"reorder_quantity" numeric(12,3) DEFAULT '0' NOT NULL,
	"average_cost" bigint DEFAULT 0 NOT NULL,
	"last_cost" bigint DEFAULT 0 NOT NULL,
	"is_sellable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "inventory_items_average_cost_min" CHECK ("average_cost" >= 0),
	CONSTRAINT "inventory_items_last_cost_min" CHECK ("last_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"count_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"system_quantity" numeric(12,3) NOT NULL,
	"counted_quantity" numeric(12,3),
	"reason" text,
	CONSTRAINT "stock_count_lines_reason_needed" CHECK ("counted_quantity" is null or "counted_quantity" = "system_quantity" or "reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "stock_count_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"counted_on" date NOT NULL,
	"status" text DEFAULT 'counting' NOT NULL,
	"approval_request_id" uuid,
	"counted_by" uuid NOT NULL,
	CONSTRAINT "stock_counts_status_chk" CHECK ("status" in ('counting', 'review', 'posted', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "stock_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_issue_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity_requested" numeric(12,3) NOT NULL,
	"quantity_issued" numeric(12,3) DEFAULT '0' NOT NULL,
	CONSTRAINT "stock_issue_lines_quantity_requested_pos" CHECK ("quantity_requested" > 0)
);
--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_issue_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"request_no" text NOT NULL,
	"requested_by_staff_id" uuid NOT NULL,
	"department_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"issued_at" timestamp with time zone,
	"issued_by" uuid,
	CONSTRAINT "stock_issue_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'issued', 'partly_issued', 'rejected', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12,3) DEFAULT '0' NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_levels_quantity_min" CHECK ("quantity" >= 0),
	CONSTRAINT "stock_levels_value_min" CHECK ("value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"movement_no" text NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quantity" numeric(12,3) NOT NULL,
	"unit_cost" bigint NOT NULL,
	"value" bigint NOT NULL,
	"balance_after" numeric(12,3) NOT NULL,
	"moved_on" date NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"department_id" uuid,
	"issued_to_staff_id" uuid,
	"cost_center_id" uuid,
	"note" text,
	CONSTRAINT "stock_movements_kind_chk" CHECK ("kind" in ('opening', 'receipt', 'issue', 'transfer_out', 'transfer_in', 'sale', 'sale_return', 'count_adjustment', 'write_off', 'return_to_vendor')),
	CONSTRAINT "stock_movements_unit_cost_min" CHECK ("unit_cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"transfer_no" text NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"sent_on" date,
	"received_on" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"lines" jsonb NOT NULL,
	"note" text,
	CONSTRAINT "stock_transfers_status_chk" CHECK ("status" in ('draft', 'in_transit', 'received', 'cancelled')),
	CONSTRAINT "stock_transfers_to_warehouse_id_differs" CHECK ("to_warehouse_id" <> "from_warehouse_id")
);
--> statement-breakpoint
ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "warehouses" (
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
	"kind" text DEFAULT 'main' NOT NULL,
	"room_id" uuid,
	"keeper_staff_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "warehouses_kind_chk" CHECK ("kind" in ('main', 'lab', 'library', 'shop', 'canteen', 'sports', 'clinic', 'other'))
);
--> statement-breakpoint
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "canteen_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"days" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "canteen_menus_status_chk" CHECK ("status" in ('draft', 'published')),
	CONSTRAINT "canteen_menus_week_start_monday" CHECK (extract(isodow from "week_start") = 1)
);
--> statement-breakpoint
ALTER TABLE "canteen_menus" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_outlets" (
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
	"kind" text NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"accepts_cash" boolean DEFAULT true NOT NULL,
	"accepts_wallet" boolean DEFAULT true NOT NULL,
	"allows_charge_to_fees" boolean DEFAULT false NOT NULL,
	"receipt_note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "shop_outlets_kind_chk" CHECK ("kind" in ('shop', 'canteen'))
);
--> statement-breakpoint
ALTER TABLE "shop_outlets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_products" (
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
	"outlet_kind" text NOT NULL,
	"item_id" uuid,
	"bundle" jsonb DEFAULT '[]' NOT NULL,
	"category" text,
	"price" bigint NOT NULL,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_restrictable" boolean DEFAULT false NOT NULL,
	"image_file_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "shop_products_outlet_kind_chk" CHECK ("outlet_kind" in ('shop', 'canteen')),
	CONSTRAINT "shop_products_price_min" CHECK ("price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shop_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"return_no" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"lines" jsonb NOT NULL,
	"amount" bigint NOT NULL,
	"refund_to" text NOT NULL,
	"reason" text NOT NULL,
	"processed_by" uuid NOT NULL,
	CONSTRAINT "shop_returns_refund_to_chk" CHECK ("refund_to" in ('cash', 'wallet', 'fees_credit')),
	CONSTRAINT "shop_returns_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shop_returns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_sale_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(10,3) NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	"returned_quantity" numeric(10,3) DEFAULT '0' NOT NULL,
	CONSTRAINT "shop_sale_lines_quantity_pos" CHECK ("quantity" > 0),
	CONSTRAINT "shop_sale_lines_unit_price_min" CHECK ("unit_price" >= 0),
	CONSTRAINT "shop_sale_lines_discount_min" CHECK ("discount" >= 0),
	CONSTRAINT "shop_sale_lines_total_min" CHECK ("total" >= 0),
	CONSTRAINT "shop_sale_lines_cost_min" CHECK ("cost" >= 0),
	CONSTRAINT "shop_sale_lines_returned_quantity_upto" CHECK ("returned_quantity" <= "quantity")
);
--> statement-breakpoint
ALTER TABLE "shop_sale_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"sale_no" text NOT NULL,
	"device_receipt_code" text,
	"outlet_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"sold_at" timestamp with time zone NOT NULL,
	"student_id" uuid,
	"family_id" uuid,
	"staff_id" uuid,
	"total" bigint NOT NULL,
	"paid_cash" bigint DEFAULT 0 NOT NULL,
	"paid_wallet" bigint DEFAULT 0 NOT NULL,
	"charged_to_fees" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"void_reason" text,
	"sold_by" uuid NOT NULL,
	CONSTRAINT "shop_sales_status_chk" CHECK ("status" in ('completed', 'voided', 'part_returned', 'returned')),
	CONSTRAINT "shop_sales_student_id_needed" CHECK (("paid_wallet" = 0 and "charged_to_fees" = 0) or "student_id" is not null),
	CONSTRAINT "shop_sales_total_min" CHECK ("total" >= 0),
	CONSTRAINT "shop_sales_paid_cash_min" CHECK ("paid_cash" >= 0),
	CONSTRAINT "shop_sales_paid_wallet_min" CHECK ("paid_wallet" >= 0),
	CONSTRAINT "shop_sales_charged_to_fees_min" CHECK ("charged_to_fees" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shop_sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shop_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"outlet_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"opening_float" bigint DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"expected_cash" bigint,
	"counted_cash" bigint,
	"difference" bigint,
	"difference_note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"device_id" uuid,
	CONSTRAINT "shop_sessions_status_chk" CHECK ("status" in ('open', 'closed', 'approved')),
	CONSTRAINT "shop_sessions_opening_float_min" CHECK ("opening_float" >= 0),
	CONSTRAINT "shop_sessions_expected_cash_min" CHECK ("expected_cash" >= 0),
	CONSTRAINT "shop_sessions_counted_cash_min" CHECK ("counted_cash" >= 0),
	CONSTRAINT "shop_sessions_difference_note_needed" CHECK (coalesce("difference", 0) = 0 or "difference_note" is not null)
);
--> statement-breakpoint
ALTER TABLE "shop_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"daily_limit" bigint,
	"low_balance_alert" bigint,
	"blocked_product_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "student_wallets_balance_min" CHECK ("balance" >= 0),
	CONSTRAINT "student_wallets_daily_limit_min" CHECK ("daily_limit" >= 0),
	CONSTRAINT "student_wallets_low_balance_alert_min" CHECK ("low_balance_alert" >= 0)
);
--> statement-breakpoint
ALTER TABLE "student_wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"wallet_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"sale_id" uuid,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"note" text,
	"done_by" uuid,
	CONSTRAINT "wallet_transactions_kind_chk" CHECK ("kind" in ('top_up', 'purchase', 'refund', 'adjustment', 'cash_out')),
	CONSTRAINT "wallet_transactions_balance_after_min" CHECK ("balance_after" >= 0)
);
--> statement-breakpoint
ALTER TABLE "wallet_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clinic_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"visit_no" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"arrived_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"sent_by_staff_id" uuid,
	"complaint" text NOT NULL,
	"temperature_c" numeric(4,1),
	"vitals" jsonb DEFAULT '{}' NOT NULL,
	"assessment" text,
	"treatment" text,
	"outcome" text,
	"guardian_informed_at" timestamp with time zone,
	"gate_pass_id" uuid,
	"follow_up_on" date,
	"attended_by" uuid NOT NULL,
	"share_with_family" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "clinic_visits_outcome_chk" CHECK ("outcome" in ('back_to_class', 'rested', 'sent_home', 'referred', 'emergency')),
	CONSTRAINT "clinic_visits_status_chk" CHECK ("status" in ('open', 'closed')),
	CONSTRAINT "clinic_visits_left_at_after" CHECK ("left_at" > "arrived_at"),
	CONSTRAINT "clinic_visits_temperature_c_range" CHECK ("temperature_c" between 30 and 45),
	CONSTRAINT "clinic_visits_person" CHECK (num_nonnulls("student_id", "staff_id") >= 1)
);
--> statement-breakpoint
ALTER TABLE "clinic_visits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_campaigns" (
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
	"kind" text NOT NULL,
	"held_on" date NOT NULL,
	"ends_on" date,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"provider" text,
	"consent_required" boolean DEFAULT true NOT NULL,
	"consent_due_on" date,
	"details" text,
	"status" text DEFAULT 'planned' NOT NULL,
	CONSTRAINT "health_campaigns_kind_chk" CHECK ("kind" in ('vaccination', 'general_checkup', 'vision', 'dental', 'hearing', 'deworming', 'growth')),
	CONSTRAINT "health_campaigns_status_chk" CHECK ("status" in ('planned', 'consent_open', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "health_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"paper_form_file_id" uuid,
	"note" text,
	CONSTRAINT "health_consents_decision_chk" CHECK ("decision" in ('pending', 'given', 'refused'))
);
--> statement-breakpoint
ALTER TABLE "health_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid NOT NULL,
	"allergies" jsonb DEFAULT '[]' NOT NULL,
	"conditions" jsonb DEFAULT '[]' NOT NULL,
	"regular_medicines" jsonb DEFAULT '[]' NOT NULL,
	"disabilities" text,
	"dietary_needs" text,
	"vision_note" text,
	"hearing_note" text,
	"family_doctor_name" text,
	"family_doctor_phone" text,
	"emergency_consent" text DEFAULT 'not_asked' NOT NULL,
	"consent_by" uuid,
	"consent_at" timestamp with time zone,
	"reviewed_on" date,
	"note" text,
	CONSTRAINT "health_profiles_emergency_consent_chk" CHECK ("emergency_consent" in ('not_asked', 'given', 'refused'))
);
--> statement-breakpoint
ALTER TABLE "health_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "health_screenings" (
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
	"campaign_id" uuid,
	"screened_on" date NOT NULL,
	"height_cm" numeric(5,1),
	"weight_kg" numeric(5,1),
	"bmi" numeric(4,1) GENERATED ALWAYS AS (round("health_screenings"."weight_kg" / (("health_screenings"."height_cm" / 100.0) * ("health_screenings"."height_cm" / 100.0)), 1)) STORED,
	"vision_left" text,
	"vision_right" text,
	"hearing" text,
	"dental" text,
	"findings" text,
	"needs_referral" boolean DEFAULT false NOT NULL,
	"referral_note" text,
	"screened_by" text,
	CONSTRAINT "health_screenings_hearing_chk" CHECK ("hearing" in ('normal', 'refer')),
	CONSTRAINT "health_screenings_dental_chk" CHECK ("dental" in ('normal', 'refer')),
	CONSTRAINT "health_screenings_height_cm_range" CHECK ("height_cm" between 50 and 220),
	CONSTRAINT "health_screenings_weight_kg_range" CHECK ("weight_kg" between 8 and 200)
);
--> statement-breakpoint
ALTER TABLE "health_screenings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"incident_no" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"first_aid" text,
	"witnesses" text,
	"reported_by" uuid NOT NULL,
	"visit_id" uuid,
	"guardian_informed_at" timestamp with time zone,
	"guardian_summary" text,
	"follow_up" text,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	CONSTRAINT "incident_reports_kind_chk" CHECK ("kind" in ('fall', 'sports_injury', 'cut_or_bruise', 'collision', 'fight', 'allergic_reaction', 'illness', 'other')),
	CONSTRAINT "incident_reports_severity_chk" CHECK ("severity" in ('minor', 'moderate', 'serious')),
	CONSTRAINT "incident_reports_status_chk" CHECK ("status" in ('open', 'reviewed', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "incident_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medication_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"plan_id" uuid,
	"visit_id" uuid,
	"medicine" text NOT NULL,
	"dose" text NOT NULL,
	"given_at" timestamp with time zone NOT NULL,
	"given_by" uuid NOT NULL,
	"item_id" uuid,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "medication_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "medication_plans" (
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
	"medicine" text NOT NULL,
	"dose" text NOT NULL,
	"times" text[] NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"prescription_file_id" uuid,
	"requested_by" uuid NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"note" text,
	CONSTRAINT "medication_plans_status_chk" CHECK ("status" in ('requested', 'active', 'declined', 'ended')),
	CONSTRAINT "medication_plans_to_date_from" CHECK ("to_date" >= "from_date")
);
--> statement-breakpoint
ALTER TABLE "medication_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vaccinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"student_id" uuid NOT NULL,
	"vaccine" text NOT NULL,
	"dose_no" integer DEFAULT 1 NOT NULL,
	"given_on" date NOT NULL,
	"campaign_id" uuid,
	"source" text NOT NULL,
	"batch_no" text,
	"given_by" text,
	"next_due_on" date,
	"card_file_id" uuid,
	CONSTRAINT "vaccinations_source_chk" CHECK ("source" in ('school_campaign', 'family_record'))
);
--> statement-breakpoint
ALTER TABLE "vaccinations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_allocations" (
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
	"hostel_id" uuid NOT NULL,
	"bed_id" uuid NOT NULL,
	"mess_plan_id" uuid,
	"from_date" date NOT NULL,
	"to_date" date,
	"room_fee" bigint NOT NULL,
	"mess_fee" bigint DEFAULT 0 NOT NULL,
	"room_fee_item_id" uuid,
	"mess_fee_item_id" uuid,
	"local_guardian_name" text,
	"local_guardian_phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"end_reason" text,
	CONSTRAINT "hostel_allocations_status_chk" CHECK ("status" in ('active', 'ended')),
	CONSTRAINT "hostel_allocations_to_date_from" CHECK ("to_date" >= "from_date"),
	CONSTRAINT "hostel_allocations_room_fee_min" CHECK ("room_fee" >= 0),
	CONSTRAINT "hostel_allocations_mess_fee_min" CHECK ("mess_fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hostel_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_attendance" (
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
	"hostel_id" uuid NOT NULL,
	"att_date" date NOT NULL,
	"roll_call" text NOT NULL,
	"status" text NOT NULL,
	"marked_by" uuid NOT NULL,
	"marked_at" timestamp with time zone NOT NULL,
	"note" text,
	CONSTRAINT "hostel_attendance_roll_call_chk" CHECK ("roll_call" in ('morning', 'evening', 'night')),
	CONSTRAINT "hostel_attendance_status_chk" CHECK ("status" in ('present', 'absent', 'on_leave', 'in_clinic', 'late'))
);
--> statement-breakpoint
ALTER TABLE "hostel_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_authorised_people" (
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
	"guardian_id" uuid,
	"name" text NOT NULL,
	"relation" text NOT NULL,
	"cnic" text,
	"phone" text,
	"photo_file_id" uuid,
	"may_visit" boolean DEFAULT true NOT NULL,
	"may_take_out" boolean DEFAULT false NOT NULL,
	"added_by" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "hostel_authorised_people_cnic_needed" CHECK ("guardian_id" is not null or "cnic" is not null)
);
--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"bed_no" text NOT NULL,
	"status" text DEFAULT 'free' NOT NULL,
	CONSTRAINT "hostel_beds_status_chk" CHECK ("status" in ('free', 'occupied', 'out_of_service'))
);
--> statement-breakpoint
ALTER TABLE "hostel_beds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_leave" (
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
	"leaves_at" timestamp with time zone NOT NULL,
	"returns_at" timestamp with time zone NOT NULL,
	"destination" text,
	"going_with_id" uuid,
	"reason" text,
	"requested_by" uuid NOT NULL,
	"guardian_confirmed_at" timestamp with time zone,
	"status" text DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"went_out_at" timestamp with time zone,
	"came_back_at" timestamp with time zone,
	"checked_out_by" uuid,
	"checked_in_by" uuid,
	CONSTRAINT "hostel_leave_kind_chk" CHECK ("kind" in ('weekend', 'home', 'medical', 'outing', 'vacation')),
	CONSTRAINT "hostel_leave_status_chk" CHECK ("status" in ('requested', 'approved', 'rejected', 'out', 'returned', 'overdue', 'cancelled')),
	CONSTRAINT "hostel_leave_returns_at_after" CHECK ("returns_at" > "leaves_at")
);
--> statement-breakpoint
ALTER TABLE "hostel_leave" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"hostel_id" uuid NOT NULL,
	"room_no" text NOT NULL,
	"floor" text,
	"kind" text DEFAULT 'shared' NOT NULL,
	"beds_count" integer NOT NULL,
	"monthly_fee" bigint NOT NULL,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'in_use' NOT NULL,
	CONSTRAINT "hostel_rooms_kind_chk" CHECK ("kind" in ('dormitory', 'shared', 'single')),
	CONSTRAINT "hostel_rooms_status_chk" CHECK ("status" in ('in_use', 'closed')),
	CONSTRAINT "hostel_rooms_beds_count_min" CHECK ("beds_count" >= 1),
	CONSTRAINT "hostel_rooms_monthly_fee_min" CHECK ("monthly_fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hostel_rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostel_visits" (
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
	"person_id" uuid,
	"visitor_name" text NOT NULL,
	"relation" text NOT NULL,
	"cnic" text,
	"arrived_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"allowed_by" uuid NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "hostel_visits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hostels" (
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
	"kind" text NOT NULL,
	"warden_staff_id" uuid,
	"assistant_warden_staff_id" uuid,
	"phone" text,
	"curfew_time" time DEFAULT '20:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "hostels_kind_chk" CHECK ("kind" in ('boys', 'girls'))
);
--> statement-breakpoint
ALTER TABLE "hostels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mess_menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"hostel_id" uuid,
	"week_start" date NOT NULL,
	"days" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "mess_menus_status_chk" CHECK ("status" in ('draft', 'published')),
	CONSTRAINT "mess_menus_week_start_monday" CHECK (extract(isodow from "week_start") = 1)
);
--> statement-breakpoint
ALTER TABLE "mess_menus" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mess_plans" (
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
	"monthly_fee" bigint NOT NULL,
	"meals" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "mess_plans_monthly_fee_min" CHECK ("monthly_fee" >= 0)
);
--> statement-breakpoint
ALTER TABLE "mess_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "facility_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"title" text NOT NULL,
	"purpose" text,
	"booked_by_staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"attendees" integer,
	"needs" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"decided_by" uuid,
	"decision_note" text,
	CONSTRAINT "facility_bookings_status_chk" CHECK ("status" in ('requested', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "facility_bookings_ends_at_after" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
ALTER TABLE "facility_bookings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"ticket_no" text NOT NULL,
	"category_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"room_id" uuid,
	"place" text,
	"asset_id" uuid,
	"priority" text DEFAULT 'normal' NOT NULL,
	"is_safety_hazard" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"waiting_reason" text,
	"reported_by" uuid NOT NULL,
	"assigned_to_staff_id" uuid,
	"vendor_id" uuid,
	"respond_by" timestamp with time zone NOT NULL,
	"resolve_by" timestamp with time zone NOT NULL,
	"first_response_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"resolution" text,
	"cost" bigint DEFAULT 0 NOT NULL,
	"expense_id" uuid,
	"reporter_rating" integer,
	"merged_into_id" uuid,
	"schedule_id" uuid,
	CONSTRAINT "maintenance_tickets_priority_chk" CHECK ("priority" in ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "maintenance_tickets_status_chk" CHECK ("status" in ('open', 'assigned', 'in_progress', 'waiting', 'resolved', 'closed', 'reopened', 'cancelled')),
	CONSTRAINT "maintenance_tickets_waiting_reason_chk" CHECK ("waiting_reason" in ('parts', 'vendor', 'approval', 'access', 'other')),
	CONSTRAINT "maintenance_tickets_waiting_reason_needed" CHECK ("status" <> 'waiting' or "waiting_reason" is not null),
	CONSTRAINT "maintenance_tickets_cost_min" CHECK ("cost" >= 0),
	CONSTRAINT "maintenance_tickets_reporter_rating_range" CHECK ("reporter_rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "preventive_schedules" (
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
	"category_id" uuid NOT NULL,
	"asset_id" uuid,
	"room_id" uuid,
	"frequency" text NOT NULL,
	"next_due_on" date NOT NULL,
	"lead_days" integer DEFAULT 3 NOT NULL,
	"assignee_staff_id" uuid,
	"checklist" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "preventive_schedules_frequency_chk" CHECK ("frequency" in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'))
);
--> statement-breakpoint
ALTER TABLE "preventive_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ticket_assignment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"assignee_staff_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ticket_assignment_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ticket_categories" (
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
	"default_assignee_role" text,
	"response_hours" integer DEFAULT 4 NOT NULL,
	"resolve_hours" integer DEFAULT 48 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "ticket_categories_kind_chk" CHECK ("kind" in ('electrical', 'plumbing', 'furniture', 'civil', 'it', 'cleaning', 'security', 'grounds', 'transport', 'other'))
);
--> statement-breakpoint
ALTER TABLE "ticket_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"body" text,
	"author_id" uuid NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"status_from" text,
	"status_to" text
);
--> statement-breakpoint
ALTER TABLE "ticket_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "goods_receipts_warehouse_id_fk_idx" ON "goods_receipts" ("warehouse_id") WHERE "warehouse_id" is not null;--> statement-breakpoint
CREATE INDEX "po_lines_item_id_fk_idx" ON "po_lines" ("item_id") WHERE "item_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_request_lines_item_id_fk_idx" ON "purchase_request_lines" ("item_id") WHERE "item_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_staff_uq" ON "drivers" ("staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fuel_logs_branch_id_fk_idx" ON "fuel_logs" ("branch_id");--> statement-breakpoint
CREATE INDEX "fuel_logs_vehicle_id_fk_idx" ON "fuel_logs" ("vehicle_id");--> statement-breakpoint
CREATE INDEX "fuel_logs_filled_by_staff_id_fk_idx" ON "fuel_logs" ("filled_by_staff_id") WHERE "filled_by_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "fuel_logs_receipt_file_id_fk_idx" ON "fuel_logs" ("receipt_file_id") WHERE "receipt_file_id" is not null;--> statement-breakpoint
CREATE INDEX "fuel_logs_expense_id_fk_idx" ON "fuel_logs" ("expense_id") WHERE "expense_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "route_stops_route_sort_order_uq" ON "route_stops" ("route_id","sort_order") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "route_stops_route_name_uq" ON "route_stops" ("route_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "route_stops_branch_id_fk_idx" ON "route_stops" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transport_assignments_active_student_uq" ON "transport_assignments" ("student_id") WHERE "status" = 'active' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transport_assignments_route_status_idx" ON "transport_assignments" ("org_id","route_id","status");--> statement-breakpoint
CREATE INDEX "transport_assignments_branch_id_fk_idx" ON "transport_assignments" ("branch_id");--> statement-breakpoint
CREATE INDEX "transport_assignments_route_id_fk_idx" ON "transport_assignments" ("route_id");--> statement-breakpoint
CREATE INDEX "transport_assignments_stop_id_fk_idx" ON "transport_assignments" ("stop_id");--> statement-breakpoint
CREATE INDEX "transport_assignments_fee_item_id_fk_idx" ON "transport_assignments" ("fee_item_id") WHERE "fee_item_id" is not null;--> statement-breakpoint
CREATE INDEX "transport_requests_branch_id_fk_idx" ON "transport_requests" ("branch_id");--> statement-breakpoint
CREATE INDEX "transport_requests_student_id_fk_idx" ON "transport_requests" ("student_id");--> statement-breakpoint
CREATE INDEX "transport_requests_stop_id_fk_idx" ON "transport_requests" ("stop_id") WHERE "stop_id" is not null;--> statement-breakpoint
CREATE INDEX "transport_requests_decided_by_fk_idx" ON "transport_requests" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "transport_routes_branch_name_uq" ON "transport_routes" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "transport_routes_branch_code_uq" ON "transport_routes" ("branch_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transport_routes_shift_id_fk_idx" ON "transport_routes" ("shift_id") WHERE "shift_id" is not null;--> statement-breakpoint
CREATE INDEX "transport_routes_vehicle_id_fk_idx" ON "transport_routes" ("vehicle_id") WHERE "vehicle_id" is not null;--> statement-breakpoint
CREATE INDEX "transport_routes_driver_staff_id_fk_idx" ON "transport_routes" ("driver_staff_id") WHERE "driver_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "transport_routes_attendant_staff_id_fk_idx" ON "transport_routes" ("attendant_staff_id") WHERE "attendant_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_events_trip_student_event_uq" ON "trip_events" ("trip_id","student_id","event") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "trip_events_branch_id_fk_idx" ON "trip_events" ("branch_id");--> statement-breakpoint
CREATE INDEX "trip_events_student_id_fk_idx" ON "trip_events" ("student_id");--> statement-breakpoint
CREATE INDEX "trip_events_stop_id_fk_idx" ON "trip_events" ("stop_id") WHERE "stop_id" is not null;--> statement-breakpoint
CREATE INDEX "trip_events_recorded_by_fk_idx" ON "trip_events" ("recorded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_route_trip_date_direction_uq" ON "trips" ("route_id","trip_date","direction") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "trips_branch_id_fk_idx" ON "trips" ("branch_id");--> statement-breakpoint
CREATE INDEX "trips_vehicle_id_fk_idx" ON "trips" ("vehicle_id");--> statement-breakpoint
CREATE INDEX "trips_driver_staff_id_fk_idx" ON "trips" ("driver_staff_id");--> statement-breakpoint
CREATE INDEX "trips_attendant_staff_id_fk_idx" ON "trips" ("attendant_staff_id") WHERE "attendant_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "vehicle_locations_vehicle_recorded_at_idx" ON "vehicle_locations" ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX "vehicle_locations_branch_id_fk_idx" ON "vehicle_locations" ("branch_id");--> statement-breakpoint
CREATE INDEX "vehicle_locations_trip_id_fk_idx" ON "vehicle_locations" ("trip_id") WHERE "trip_id" is not null;--> statement-breakpoint
CREATE INDEX "vehicle_maintenance_branch_id_fk_idx" ON "vehicle_maintenance" ("branch_id");--> statement-breakpoint
CREATE INDEX "vehicle_maintenance_vehicle_id_fk_idx" ON "vehicle_maintenance" ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_maintenance_vendor_id_fk_idx" ON "vehicle_maintenance" ("vendor_id") WHERE "vendor_id" is not null;--> statement-breakpoint
CREATE INDEX "vehicle_maintenance_expense_id_fk_idx" ON "vehicle_maintenance" ("expense_id") WHERE "expense_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_no_uq" ON "vehicles" ("org_id","registration_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vehicles_branch_id_fk_idx" ON "vehicles" ("branch_id");--> statement-breakpoint
CREATE INDEX "vehicles_contractor_vendor_id_fk_idx" ON "vehicles" ("contractor_vendor_id") WHERE "contractor_vendor_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_categories_name_uq" ON "library_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "library_categories_parent_id_fk_idx" ON "library_categories" ("parent_id") WHERE "parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_copies_branch_accession_no_uq" ON "library_copies" ("branch_id","accession_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_copies_barcode_uq" ON "library_copies" ("org_id","barcode") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "library_copies_item_status_idx" ON "library_copies" ("org_id","item_id","status");--> statement-breakpoint
CREATE INDEX "library_copies_item_id_fk_idx" ON "library_copies" ("item_id");--> statement-breakpoint
CREATE INDEX "library_fines_branch_id_fk_idx" ON "library_fines" ("branch_id");--> statement-breakpoint
CREATE INDEX "library_fines_loan_id_fk_idx" ON "library_fines" ("loan_id");--> statement-breakpoint
CREATE INDEX "library_fines_student_id_fk_idx" ON "library_fines" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "library_fines_staff_id_fk_idx" ON "library_fines" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "library_fines_fee_voucher_id_fk_idx" ON "library_fines" ("fee_voucher_id") WHERE "fee_voucher_id" is not null;--> statement-breakpoint
CREATE INDEX "library_fines_received_by_fk_idx" ON "library_fines" ("received_by") WHERE "received_by" is not null;--> statement-breakpoint
CREATE INDEX "library_fines_waived_by_fk_idx" ON "library_fines" ("waived_by") WHERE "waived_by" is not null;--> statement-breakpoint
CREATE INDEX "library_items_isbn_idx" ON "library_items" ("org_id","isbn");--> statement-breakpoint
CREATE INDEX "library_items_category_id_fk_idx" ON "library_items" ("category_id") WHERE "category_id" is not null;--> statement-breakpoint
CREATE INDEX "library_items_cover_file_id_fk_idx" ON "library_items" ("cover_file_id") WHERE "cover_file_id" is not null;--> statement-breakpoint
CREATE INDEX "library_items_digital_file_id_fk_idx" ON "library_items" ("digital_file_id") WHERE "digital_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_loans_copy_on_loan_uq" ON "library_loans" ("copy_id") WHERE "status" = 'on_loan' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "library_loans_student_status_idx" ON "library_loans" ("org_id","student_id","status");--> statement-breakpoint
CREATE INDEX "library_loans_staff_status_idx" ON "library_loans" ("org_id","staff_id","status");--> statement-breakpoint
CREATE INDEX "library_loans_branch_due_on_idx" ON "library_loans" ("org_id","branch_id","due_on") WHERE "status" = 'on_loan';--> statement-breakpoint
CREATE INDEX "library_loans_branch_id_fk_idx" ON "library_loans" ("branch_id");--> statement-breakpoint
CREATE INDEX "library_loans_item_id_fk_idx" ON "library_loans" ("item_id");--> statement-breakpoint
CREATE INDEX "library_loans_student_id_fk_idx" ON "library_loans" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "library_loans_staff_id_fk_idx" ON "library_loans" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "library_loans_issued_by_fk_idx" ON "library_loans" ("issued_by");--> statement-breakpoint
CREATE INDEX "library_loans_returned_to_fk_idx" ON "library_loans" ("returned_to") WHERE "returned_to" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_members_branch_student_uq" ON "library_members" ("branch_id","student_id") WHERE "deleted_at" is null and "student_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_members_branch_staff_uq" ON "library_members" ("branch_id","staff_id") WHERE "deleted_at" is null and "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "library_members_student_id_fk_idx" ON "library_members" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "library_members_staff_id_fk_idx" ON "library_members" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "library_reservations_branch_id_fk_idx" ON "library_reservations" ("branch_id");--> statement-breakpoint
CREATE INDEX "library_reservations_item_id_fk_idx" ON "library_reservations" ("item_id");--> statement-breakpoint
CREATE INDEX "library_reservations_student_id_fk_idx" ON "library_reservations" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "library_reservations_staff_id_fk_idx" ON "library_reservations" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "library_reservations_copy_id_fk_idx" ON "library_reservations" ("copy_id") WHERE "copy_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "library_stock_check_scans_stock_check_copy_uq" ON "library_stock_check_scans" ("stock_check_id","copy_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "library_stock_check_scans_branch_id_fk_idx" ON "library_stock_check_scans" ("branch_id");--> statement-breakpoint
CREATE INDEX "library_stock_check_scans_copy_id_fk_idx" ON "library_stock_check_scans" ("copy_id");--> statement-breakpoint
CREATE INDEX "library_stock_check_scans_scanned_by_fk_idx" ON "library_stock_check_scans" ("scanned_by");--> statement-breakpoint
CREATE INDEX "library_stock_checks_branch_id_fk_idx" ON "library_stock_checks" ("branch_id");--> statement-breakpoint
CREATE INDEX "asset_assignments_branch_id_fk_idx" ON "asset_assignments" ("branch_id");--> statement-breakpoint
CREATE INDEX "asset_assignments_asset_id_fk_idx" ON "asset_assignments" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_assignments_staff_id_fk_idx" ON "asset_assignments" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_assignments_room_id_fk_idx" ON "asset_assignments" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_audits_branch_id_fk_idx" ON "asset_audits" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asset_categories_name_uq" ON "asset_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "asset_categories_asset_account_id_fk_idx" ON "asset_categories" ("asset_account_id") WHERE "asset_account_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_maintenance_branch_id_fk_idx" ON "asset_maintenance" ("branch_id");--> statement-breakpoint
CREATE INDEX "asset_maintenance_asset_id_fk_idx" ON "asset_maintenance" ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_maintenance_vendor_id_fk_idx" ON "asset_maintenance" ("vendor_id") WHERE "vendor_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_maintenance_ticket_id_fk_idx" ON "asset_maintenance" ("ticket_id") WHERE "ticket_id" is not null;--> statement-breakpoint
CREATE INDEX "asset_maintenance_expense_id_fk_idx" ON "asset_maintenance" ("expense_id") WHERE "expense_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_asset_no_uq" ON "assets" ("org_id","asset_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_branch_status_idx" ON "assets" ("org_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "assets_custodian_staff_idx" ON "assets" ("org_id","custodian_staff_id");--> statement-breakpoint
CREATE INDEX "assets_room_idx" ON "assets" ("org_id","room_id");--> statement-breakpoint
CREATE INDEX "assets_branch_id_fk_idx" ON "assets" ("branch_id");--> statement-breakpoint
CREATE INDEX "assets_category_id_fk_idx" ON "assets" ("category_id");--> statement-breakpoint
CREATE INDEX "assets_vendor_id_fk_idx" ON "assets" ("vendor_id") WHERE "vendor_id" is not null;--> statement-breakpoint
CREATE INDEX "assets_vendor_bill_id_fk_idx" ON "assets" ("vendor_bill_id") WHERE "vendor_bill_id" is not null;--> statement-breakpoint
CREATE INDEX "assets_room_id_fk_idx" ON "assets" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "assets_custodian_staff_id_fk_idx" ON "assets" ("custodian_staff_id") WHERE "custodian_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "depreciation_runs_posted_period_uq" ON "depreciation_runs" ("fiscal_period_id") WHERE "status" = 'posted' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "depreciation_runs_posted_by_fk_idx" ON "depreciation_runs" ("posted_by") WHERE "posted_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_categories_name_uq" ON "inventory_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "inventory_categories_parent_id_fk_idx" ON "inventory_categories" ("parent_id") WHERE "parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_sku_uq" ON "inventory_items" ("org_id","sku") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_barcode_uq" ON "inventory_items" ("org_id","barcode") WHERE "deleted_at" is null and "barcode" is not null;--> statement-breakpoint
CREATE INDEX "inventory_items_name_trgm" ON "inventory_items" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "inventory_items_category_idx" ON "inventory_items" ("org_id","category_id");--> statement-breakpoint
CREATE INDEX "inventory_items_category_id_fk_idx" ON "inventory_items" ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_lines_count_item_uq" ON "stock_count_lines" ("count_id","item_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_count_lines_branch_id_fk_idx" ON "stock_count_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_count_lines_item_id_fk_idx" ON "stock_count_lines" ("item_id");--> statement-breakpoint
CREATE INDEX "stock_counts_branch_id_fk_idx" ON "stock_counts" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_counts_warehouse_id_fk_idx" ON "stock_counts" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_counts_approval_request_id_fk_idx" ON "stock_counts" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_counts_counted_by_fk_idx" ON "stock_counts" ("counted_by");--> statement-breakpoint
CREATE INDEX "stock_issue_lines_branch_id_fk_idx" ON "stock_issue_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_issue_lines_request_id_fk_idx" ON "stock_issue_lines" ("request_id");--> statement-breakpoint
CREATE INDEX "stock_issue_lines_item_id_fk_idx" ON "stock_issue_lines" ("item_id");--> statement-breakpoint
CREATE INDEX "stock_issue_requests_branch_id_fk_idx" ON "stock_issue_requests" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_issue_requests_requested_by_staff_id_fk_idx" ON "stock_issue_requests" ("requested_by_staff_id");--> statement-breakpoint
CREATE INDEX "stock_issue_requests_department_id_fk_idx" ON "stock_issue_requests" ("department_id") WHERE "department_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_issue_requests_warehouse_id_fk_idx" ON "stock_issue_requests" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_issue_requests_approval_request_id_fk_idx" ON "stock_issue_requests" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_issue_requests_issued_by_fk_idx" ON "stock_issue_requests" ("issued_by") WHERE "issued_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_levels_warehouse_item_uq" ON "stock_levels" ("warehouse_id","item_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "stock_levels_branch_id_fk_idx" ON "stock_levels" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_levels_item_id_fk_idx" ON "stock_levels" ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_source_type_source_item_kind_uq" ON "stock_movements" ("source_type","source_id","item_id","kind") WHERE "source_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_movements_warehouse_item_moved_on_idx" ON "stock_movements" ("org_id","warehouse_id","item_id","moved_on");--> statement-breakpoint
CREATE INDEX "stock_movements_branch_id_fk_idx" ON "stock_movements" ("branch_id");--> statement-breakpoint
CREATE INDEX "stock_movements_warehouse_id_fk_idx" ON "stock_movements" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_id_fk_idx" ON "stock_movements" ("item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_department_id_fk_idx" ON "stock_movements" ("department_id") WHERE "department_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_movements_issued_to_staff_id_fk_idx" ON "stock_movements" ("issued_to_staff_id") WHERE "issued_to_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_movements_cost_center_id_fk_idx" ON "stock_movements" ("cost_center_id") WHERE "cost_center_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_transfers_from_warehouse_id_fk_idx" ON "stock_transfers" ("from_warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_to_warehouse_id_fk_idx" ON "stock_transfers" ("to_warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_branch_name_uq" ON "warehouses" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "warehouses_room_id_fk_idx" ON "warehouses" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "warehouses_keeper_staff_id_fk_idx" ON "warehouses" ("keeper_staff_id") WHERE "keeper_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "canteen_menus_branch_week_start_uq" ON "canteen_menus" ("branch_id","week_start") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_outlets_branch_name_uq" ON "shop_outlets" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "shop_outlets_warehouse_id_fk_idx" ON "shop_outlets" ("warehouse_id");--> statement-breakpoint
CREATE INDEX "shop_products_item_id_fk_idx" ON "shop_products" ("item_id") WHERE "item_id" is not null;--> statement-breakpoint
CREATE INDEX "shop_products_image_file_id_fk_idx" ON "shop_products" ("image_file_id") WHERE "image_file_id" is not null;--> statement-breakpoint
CREATE INDEX "shop_returns_branch_id_fk_idx" ON "shop_returns" ("branch_id");--> statement-breakpoint
CREATE INDEX "shop_returns_sale_id_fk_idx" ON "shop_returns" ("sale_id");--> statement-breakpoint
CREATE INDEX "shop_returns_session_id_fk_idx" ON "shop_returns" ("session_id");--> statement-breakpoint
CREATE INDEX "shop_returns_processed_by_fk_idx" ON "shop_returns" ("processed_by");--> statement-breakpoint
CREATE INDEX "shop_sale_lines_branch_id_fk_idx" ON "shop_sale_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "shop_sale_lines_sale_id_fk_idx" ON "shop_sale_lines" ("sale_id");--> statement-breakpoint
CREATE INDEX "shop_sale_lines_product_id_fk_idx" ON "shop_sale_lines" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_sales_sale_no_uq" ON "shop_sales" ("org_id","sale_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_sales_device_receipt_code_uq" ON "shop_sales" ("org_id","device_receipt_code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "shop_sales_student_sold_at_idx" ON "shop_sales" ("org_id","student_id","sold_at");--> statement-breakpoint
CREATE INDEX "shop_sales_session_idx" ON "shop_sales" ("org_id","session_id");--> statement-breakpoint
CREATE INDEX "shop_sales_branch_id_fk_idx" ON "shop_sales" ("branch_id");--> statement-breakpoint
CREATE INDEX "shop_sales_outlet_id_fk_idx" ON "shop_sales" ("outlet_id");--> statement-breakpoint
CREATE INDEX "shop_sales_session_id_fk_idx" ON "shop_sales" ("session_id");--> statement-breakpoint
CREATE INDEX "shop_sales_student_id_fk_idx" ON "shop_sales" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "shop_sales_family_id_fk_idx" ON "shop_sales" ("family_id") WHERE "family_id" is not null;--> statement-breakpoint
CREATE INDEX "shop_sales_staff_id_fk_idx" ON "shop_sales" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "shop_sales_sold_by_fk_idx" ON "shop_sales" ("sold_by");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_sessions_open_uq" ON "shop_sessions" ("cashier_id","outlet_id") WHERE "status" = 'open' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "shop_sessions_branch_id_fk_idx" ON "shop_sessions" ("branch_id");--> statement-breakpoint
CREATE INDEX "shop_sessions_outlet_id_fk_idx" ON "shop_sessions" ("outlet_id");--> statement-breakpoint
CREATE INDEX "shop_sessions_device_id_fk_idx" ON "shop_sessions" ("device_id") WHERE "device_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "student_wallets_student_uq" ON "student_wallets" ("student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_transactions_source_type_source_kind_uq" ON "wallet_transactions" ("source_type","source_id","kind") WHERE "source_id" is not null;--> statement-breakpoint
CREATE INDEX "wallet_transactions_wallet_created_at_idx" ON "wallet_transactions" ("org_id","wallet_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_transactions_wallet_id_fk_idx" ON "wallet_transactions" ("wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_student_id_fk_idx" ON "wallet_transactions" ("student_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_sale_id_fk_idx" ON "wallet_transactions" ("sale_id") WHERE "sale_id" is not null;--> statement-breakpoint
CREATE INDEX "wallet_transactions_done_by_fk_idx" ON "wallet_transactions" ("done_by") WHERE "done_by" is not null;--> statement-breakpoint
CREATE INDEX "clinic_visits_branch_arrived_at_idx" ON "clinic_visits" ("org_id","branch_id","arrived_at");--> statement-breakpoint
CREATE INDEX "clinic_visits_student_arrived_at_idx" ON "clinic_visits" ("org_id","student_id","arrived_at");--> statement-breakpoint
CREATE INDEX "clinic_visits_branch_id_fk_idx" ON "clinic_visits" ("branch_id");--> statement-breakpoint
CREATE INDEX "clinic_visits_student_id_fk_idx" ON "clinic_visits" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "clinic_visits_staff_id_fk_idx" ON "clinic_visits" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "clinic_visits_sent_by_staff_id_fk_idx" ON "clinic_visits" ("sent_by_staff_id") WHERE "sent_by_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "clinic_visits_gate_pass_id_fk_idx" ON "clinic_visits" ("gate_pass_id") WHERE "gate_pass_id" is not null;--> statement-breakpoint
CREATE INDEX "clinic_visits_attended_by_fk_idx" ON "clinic_visits" ("attended_by");--> statement-breakpoint
CREATE INDEX "health_campaigns_branch_id_fk_idx" ON "health_campaigns" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "health_consents_campaign_student_uq" ON "health_consents" ("campaign_id","student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "health_consents_branch_id_fk_idx" ON "health_consents" ("branch_id");--> statement-breakpoint
CREATE INDEX "health_consents_student_id_fk_idx" ON "health_consents" ("student_id");--> statement-breakpoint
CREATE INDEX "health_consents_decided_by_fk_idx" ON "health_consents" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "health_consents_paper_form_file_id_fk_idx" ON "health_consents" ("paper_form_file_id") WHERE "paper_form_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "health_profiles_student_uq" ON "health_profiles" ("student_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "health_profiles_consent_by_fk_idx" ON "health_profiles" ("consent_by") WHERE "consent_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "health_screenings_student_campaign_uq" ON "health_screenings" ("student_id","campaign_id") WHERE "deleted_at" is null and "campaign_id" is not null;--> statement-breakpoint
CREATE INDEX "health_screenings_branch_id_fk_idx" ON "health_screenings" ("branch_id");--> statement-breakpoint
CREATE INDEX "health_screenings_campaign_id_fk_idx" ON "health_screenings" ("campaign_id") WHERE "campaign_id" is not null;--> statement-breakpoint
CREATE INDEX "incident_reports_branch_id_fk_idx" ON "incident_reports" ("branch_id");--> statement-breakpoint
CREATE INDEX "incident_reports_student_id_fk_idx" ON "incident_reports" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "incident_reports_staff_id_fk_idx" ON "incident_reports" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "incident_reports_reported_by_fk_idx" ON "incident_reports" ("reported_by");--> statement-breakpoint
CREATE INDEX "incident_reports_visit_id_fk_idx" ON "incident_reports" ("visit_id") WHERE "visit_id" is not null;--> statement-breakpoint
CREATE INDEX "incident_reports_reviewed_by_fk_idx" ON "incident_reports" ("reviewed_by") WHERE "reviewed_by" is not null;--> statement-breakpoint
CREATE INDEX "medication_log_branch_id_fk_idx" ON "medication_log" ("branch_id");--> statement-breakpoint
CREATE INDEX "medication_log_student_id_fk_idx" ON "medication_log" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "medication_log_staff_id_fk_idx" ON "medication_log" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "medication_log_plan_id_fk_idx" ON "medication_log" ("plan_id") WHERE "plan_id" is not null;--> statement-breakpoint
CREATE INDEX "medication_log_visit_id_fk_idx" ON "medication_log" ("visit_id") WHERE "visit_id" is not null;--> statement-breakpoint
CREATE INDEX "medication_log_given_by_fk_idx" ON "medication_log" ("given_by");--> statement-breakpoint
CREATE INDEX "medication_log_item_id_fk_idx" ON "medication_log" ("item_id") WHERE "item_id" is not null;--> statement-breakpoint
CREATE INDEX "medication_plans_branch_id_fk_idx" ON "medication_plans" ("branch_id");--> statement-breakpoint
CREATE INDEX "medication_plans_student_id_fk_idx" ON "medication_plans" ("student_id");--> statement-breakpoint
CREATE INDEX "medication_plans_prescription_file_id_fk_idx" ON "medication_plans" ("prescription_file_id") WHERE "prescription_file_id" is not null;--> statement-breakpoint
CREATE INDEX "medication_plans_requested_by_fk_idx" ON "medication_plans" ("requested_by");--> statement-breakpoint
CREATE INDEX "medication_plans_decided_by_fk_idx" ON "medication_plans" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vaccinations_student_vaccine_dose_no_uq" ON "vaccinations" ("student_id","vaccine","dose_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vaccinations_campaign_id_fk_idx" ON "vaccinations" ("campaign_id") WHERE "campaign_id" is not null;--> statement-breakpoint
CREATE INDEX "vaccinations_card_file_id_fk_idx" ON "vaccinations" ("card_file_id") WHERE "card_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_allocations_active_student_uq" ON "hostel_allocations" ("student_id") WHERE "status" = 'active' and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hostel_allocations_hostel_status_idx" ON "hostel_allocations" ("org_id","hostel_id","status");--> statement-breakpoint
CREATE INDEX "hostel_allocations_branch_id_fk_idx" ON "hostel_allocations" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_allocations_hostel_id_fk_idx" ON "hostel_allocations" ("hostel_id");--> statement-breakpoint
CREATE INDEX "hostel_allocations_bed_id_fk_idx" ON "hostel_allocations" ("bed_id");--> statement-breakpoint
CREATE INDEX "hostel_allocations_mess_plan_id_fk_idx" ON "hostel_allocations" ("mess_plan_id") WHERE "mess_plan_id" is not null;--> statement-breakpoint
CREATE INDEX "hostel_allocations_room_fee_item_id_fk_idx" ON "hostel_allocations" ("room_fee_item_id") WHERE "room_fee_item_id" is not null;--> statement-breakpoint
CREATE INDEX "hostel_allocations_mess_fee_item_id_fk_idx" ON "hostel_allocations" ("mess_fee_item_id") WHERE "mess_fee_item_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_attendance_student_att_date_roll_call_uq" ON "hostel_attendance" ("student_id","att_date","roll_call") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hostel_attendance_hostel_att_date_roll_call_idx" ON "hostel_attendance" ("org_id","hostel_id","att_date","roll_call");--> statement-breakpoint
CREATE INDEX "hostel_attendance_branch_id_fk_idx" ON "hostel_attendance" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_attendance_hostel_id_fk_idx" ON "hostel_attendance" ("hostel_id");--> statement-breakpoint
CREATE INDEX "hostel_attendance_marked_by_fk_idx" ON "hostel_attendance" ("marked_by");--> statement-breakpoint
CREATE INDEX "hostel_authorised_people_branch_id_fk_idx" ON "hostel_authorised_people" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_authorised_people_student_id_fk_idx" ON "hostel_authorised_people" ("student_id");--> statement-breakpoint
CREATE INDEX "hostel_authorised_people_guardian_id_fk_idx" ON "hostel_authorised_people" ("guardian_id") WHERE "guardian_id" is not null;--> statement-breakpoint
CREATE INDEX "hostel_authorised_people_photo_file_id_fk_idx" ON "hostel_authorised_people" ("photo_file_id") WHERE "photo_file_id" is not null;--> statement-breakpoint
CREATE INDEX "hostel_authorised_people_added_by_fk_idx" ON "hostel_authorised_people" ("added_by");--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_beds_room_bed_no_uq" ON "hostel_beds" ("room_id","bed_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hostel_beds_branch_id_fk_idx" ON "hostel_beds" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_leave_branch_id_fk_idx" ON "hostel_leave" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_leave_student_id_fk_idx" ON "hostel_leave" ("student_id");--> statement-breakpoint
CREATE INDEX "hostel_leave_going_with_id_fk_idx" ON "hostel_leave" ("going_with_id") WHERE "going_with_id" is not null;--> statement-breakpoint
CREATE INDEX "hostel_leave_requested_by_fk_idx" ON "hostel_leave" ("requested_by");--> statement-breakpoint
CREATE INDEX "hostel_leave_decided_by_fk_idx" ON "hostel_leave" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "hostel_leave_checked_out_by_fk_idx" ON "hostel_leave" ("checked_out_by") WHERE "checked_out_by" is not null;--> statement-breakpoint
CREATE INDEX "hostel_leave_checked_in_by_fk_idx" ON "hostel_leave" ("checked_in_by") WHERE "checked_in_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "hostel_rooms_hostel_room_no_uq" ON "hostel_rooms" ("hostel_id","room_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hostel_rooms_branch_id_fk_idx" ON "hostel_rooms" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_visits_branch_id_fk_idx" ON "hostel_visits" ("branch_id");--> statement-breakpoint
CREATE INDEX "hostel_visits_student_id_fk_idx" ON "hostel_visits" ("student_id");--> statement-breakpoint
CREATE INDEX "hostel_visits_person_id_fk_idx" ON "hostel_visits" ("person_id") WHERE "person_id" is not null;--> statement-breakpoint
CREATE INDEX "hostel_visits_allowed_by_fk_idx" ON "hostel_visits" ("allowed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "hostels_branch_name_uq" ON "hostels" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hostels_warden_staff_id_fk_idx" ON "hostels" ("warden_staff_id") WHERE "warden_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "hostels_assistant_warden_staff_id_fk_idx" ON "hostels" ("assistant_warden_staff_id") WHERE "assistant_warden_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mess_menus_branch_hostel_week_start_uq" ON "mess_menus" ("branch_id",coalesce("hostel_id", '00000000-0000-0000-0000-000000000000'::uuid),"week_start") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "mess_menus_hostel_id_fk_idx" ON "mess_menus" ("hostel_id") WHERE "hostel_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mess_plans_branch_name_uq" ON "mess_plans" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "facility_bookings_room_starts_at_idx" ON "facility_bookings" ("org_id","room_id","starts_at");--> statement-breakpoint
CREATE INDEX "facility_bookings_branch_id_fk_idx" ON "facility_bookings" ("branch_id");--> statement-breakpoint
CREATE INDEX "facility_bookings_room_id_fk_idx" ON "facility_bookings" ("room_id");--> statement-breakpoint
CREATE INDEX "facility_bookings_booked_by_staff_id_fk_idx" ON "facility_bookings" ("booked_by_staff_id");--> statement-breakpoint
CREATE INDEX "facility_bookings_decided_by_fk_idx" ON "facility_bookings" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_branch_status_priority_idx" ON "maintenance_tickets" ("org_id","branch_id","status","priority");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_assigned_to_staff_status_idx" ON "maintenance_tickets" ("org_id","assigned_to_staff_id","status");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_reported_by_idx" ON "maintenance_tickets" ("org_id","reported_by");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_branch_id_fk_idx" ON "maintenance_tickets" ("branch_id");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_category_id_fk_idx" ON "maintenance_tickets" ("category_id");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_room_id_fk_idx" ON "maintenance_tickets" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_asset_id_fk_idx" ON "maintenance_tickets" ("asset_id") WHERE "asset_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_reported_by_fk_idx" ON "maintenance_tickets" ("reported_by");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_assigned_to_staff_id_fk_idx" ON "maintenance_tickets" ("assigned_to_staff_id") WHERE "assigned_to_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_vendor_id_fk_idx" ON "maintenance_tickets" ("vendor_id") WHERE "vendor_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_expense_id_fk_idx" ON "maintenance_tickets" ("expense_id") WHERE "expense_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_merged_into_id_fk_idx" ON "maintenance_tickets" ("merged_into_id") WHERE "merged_into_id" is not null;--> statement-breakpoint
CREATE INDEX "maintenance_tickets_schedule_id_fk_idx" ON "maintenance_tickets" ("schedule_id") WHERE "schedule_id" is not null;--> statement-breakpoint
CREATE INDEX "preventive_schedules_branch_id_fk_idx" ON "preventive_schedules" ("branch_id");--> statement-breakpoint
CREATE INDEX "preventive_schedules_category_id_fk_idx" ON "preventive_schedules" ("category_id");--> statement-breakpoint
CREATE INDEX "preventive_schedules_asset_id_fk_idx" ON "preventive_schedules" ("asset_id") WHERE "asset_id" is not null;--> statement-breakpoint
CREATE INDEX "preventive_schedules_room_id_fk_idx" ON "preventive_schedules" ("room_id") WHERE "room_id" is not null;--> statement-breakpoint
CREATE INDEX "preventive_schedules_assignee_staff_id_fk_idx" ON "preventive_schedules" ("assignee_staff_id") WHERE "assignee_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_assignment_rules_branch_category_uq" ON "ticket_assignment_rules" ("branch_id","category_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ticket_assignment_rules_category_id_fk_idx" ON "ticket_assignment_rules" ("category_id");--> statement-breakpoint
CREATE INDEX "ticket_assignment_rules_assignee_staff_id_fk_idx" ON "ticket_assignment_rules" ("assignee_staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_categories_name_uq" ON "ticket_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "ticket_comments_branch_id_fk_idx" ON "ticket_comments" ("branch_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_id_fk_idx" ON "ticket_comments" ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_comments_author_id_fk_idx" ON "ticket_comments" ("author_id");--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_filled_by_staff_id_staff_id_fkey" FOREIGN KEY ("filled_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_receipt_file_id_files_id_fkey" FOREIGN KEY ("receipt_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id");--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_transport_routes_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id");--> statement-breakpoint
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_route_id_transport_routes_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id");--> statement-breakpoint
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_stop_id_route_stops_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id");--> statement-breakpoint
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_fee_item_id_student_fee_items_id_fkey" FOREIGN KEY ("fee_item_id") REFERENCES "student_fee_items"("id");--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_stop_id_route_stops_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id");--> statement-breakpoint
ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id");--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_driver_staff_id_staff_id_fkey" FOREIGN KEY ("driver_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_attendant_staff_id_staff_id_fkey" FOREIGN KEY ("attendant_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_trip_id_trips_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id");--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_stop_id_route_stops_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "route_stops"("id");--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_recorded_by_profiles_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_route_id_transport_routes_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transport_routes"("id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_staff_id_staff_id_fkey" FOREIGN KEY ("driver_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_attendant_staff_id_staff_id_fkey" FOREIGN KEY ("attendant_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_trip_id_trips_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id");--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicle_id_vehicles_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id");--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_contractor_vendor_id_vendors_id_fkey" FOREIGN KEY ("contractor_vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_parent_id_library_categories_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "library_categories"("id");--> statement-breakpoint
ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_item_id_library_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_loan_id_library_loans_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "library_loans"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_fee_voucher_id_fee_vouchers_id_fkey" FOREIGN KEY ("fee_voucher_id") REFERENCES "fee_vouchers"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_received_by_profiles_id_fkey" FOREIGN KEY ("received_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_waived_by_profiles_id_fkey" FOREIGN KEY ("waived_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_category_id_library_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "library_categories"("id");--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_cover_file_id_files_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_digital_file_id_files_id_fkey" FOREIGN KEY ("digital_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_copy_id_library_copies_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "library_copies"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_item_id_library_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_issued_by_profiles_id_fkey" FOREIGN KEY ("issued_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_returned_to_profiles_id_fkey" FOREIGN KEY ("returned_to") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "library_policies" ADD CONSTRAINT "library_policies_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_item_id_library_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "library_items"("id");--> statement-breakpoint
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_copy_id_library_copies_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "library_copies"("id");--> statement-breakpoint
ALTER TABLE "library_stock_check_scans" ADD CONSTRAINT "library_stock_check_scans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_stock_check_scans" ADD CONSTRAINT "library_stock_check_scans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "library_stock_check_scans" ADD CONSTRAINT "library_stock_check_scans_stock_check_id_library_stock_86f0da7e" FOREIGN KEY ("stock_check_id") REFERENCES "library_stock_checks"("id");--> statement-breakpoint
ALTER TABLE "library_stock_check_scans" ADD CONSTRAINT "library_stock_check_scans_copy_id_library_copies_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "library_copies"("id");--> statement-breakpoint
ALTER TABLE "library_stock_check_scans" ADD CONSTRAINT "library_stock_check_scans_scanned_by_profiles_id_fkey" FOREIGN KEY ("scanned_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "library_stock_checks" ADD CONSTRAINT "library_stock_checks_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "library_stock_checks" ADD CONSTRAINT "library_stock_checks_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "asset_audits" ADD CONSTRAINT "asset_audits_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "asset_audits" ADD CONSTRAINT "asset_audits_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_asset_account_id_accounts_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_ticket_id_maintenance_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "maintenance_tickets"("id");--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_asset_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_vendor_bill_id_vendor_bills_id_fkey" FOREIGN KEY ("vendor_bill_id") REFERENCES "vendor_bills"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_custodian_staff_id_staff_id_fkey" FOREIGN KEY ("custodian_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_fiscal_period_id_fiscal_periods_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id");--> statement-breakpoint
ALTER TABLE "depreciation_runs" ADD CONSTRAINT "depreciation_runs_posted_by_profiles_id_fkey" FOREIGN KEY ("posted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_parent_id_inventory_categories_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inventory_categories"("id");--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_inventory_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id");--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_count_id_stock_counts_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_counts"("id");--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_counted_by_profiles_id_fkey" FOREIGN KEY ("counted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_request_id_stock_issue_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "stock_issue_requests"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_requested_by_staff_id_staff_id_fkey" FOREIGN KEY ("requested_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_approval_request_id_approval_requ_7a2d361c" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "stock_issue_requests" ADD CONSTRAINT "stock_issue_requests_issued_by_profiles_id_fkey" FOREIGN KEY ("issued_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_issued_to_staff_id_staff_id_fkey" FOREIGN KEY ("issued_to_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_keeper_staff_id_staff_id_fkey" FOREIGN KEY ("keeper_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "canteen_menus" ADD CONSTRAINT "canteen_menus_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "canteen_menus" ADD CONSTRAINT "canteen_menus_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shop_outlets" ADD CONSTRAINT "shop_outlets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shop_outlets" ADD CONSTRAINT "shop_outlets_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shop_outlets" ADD CONSTRAINT "shop_outlets_warehouse_id_warehouses_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id");--> statement-breakpoint
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_image_file_id_files_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_sale_id_shop_sales_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "shop_sales"("id");--> statement-breakpoint
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_session_id_shop_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "shop_sessions"("id");--> statement-breakpoint
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_processed_by_profiles_id_fkey" FOREIGN KEY ("processed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "shop_sale_lines" ADD CONSTRAINT "shop_sale_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shop_sale_lines" ADD CONSTRAINT "shop_sale_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shop_sale_lines" ADD CONSTRAINT "shop_sale_lines_sale_id_shop_sales_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "shop_sales"("id");--> statement-breakpoint
ALTER TABLE "shop_sale_lines" ADD CONSTRAINT "shop_sale_lines_product_id_shop_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop_products"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_outlet_id_shop_outlets_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "shop_outlets"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_session_id_shop_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "shop_sessions"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "shop_sales" ADD CONSTRAINT "shop_sales_sold_by_profiles_id_fkey" FOREIGN KEY ("sold_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "shop_sessions" ADD CONSTRAINT "shop_sessions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "shop_sessions" ADD CONSTRAINT "shop_sessions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "shop_sessions" ADD CONSTRAINT "shop_sessions_outlet_id_shop_outlets_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "shop_outlets"("id");--> statement-breakpoint
ALTER TABLE "shop_sessions" ADD CONSTRAINT "shop_sessions_cashier_id_profiles_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "shop_sessions" ADD CONSTRAINT "shop_sessions_device_id_sync_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_devices"("id");--> statement-breakpoint
ALTER TABLE "student_wallets" ADD CONSTRAINT "student_wallets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_wallets" ADD CONSTRAINT "student_wallets_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_student_wallets_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "student_wallets"("id");--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_sale_id_shop_sales_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "shop_sales"("id");--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_done_by_profiles_id_fkey" FOREIGN KEY ("done_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_sent_by_staff_id_staff_id_fkey" FOREIGN KEY ("sent_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_gate_pass_id_gate_passes_id_fkey" FOREIGN KEY ("gate_pass_id") REFERENCES "gate_passes"("id");--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_attended_by_profiles_id_fkey" FOREIGN KEY ("attended_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "health_campaigns" ADD CONSTRAINT "health_campaigns_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "health_campaigns" ADD CONSTRAINT "health_campaigns_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "health_consents" ADD CONSTRAINT "health_consents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "health_consents" ADD CONSTRAINT "health_consents_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "health_consents" ADD CONSTRAINT "health_consents_campaign_id_health_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "health_campaigns"("id");--> statement-breakpoint
ALTER TABLE "health_consents" ADD CONSTRAINT "health_consents_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "health_consents" ADD CONSTRAINT "health_consents_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "health_consents" ADD CONSTRAINT "health_consents_paper_form_file_id_files_id_fkey" FOREIGN KEY ("paper_form_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "health_profiles" ADD CONSTRAINT "health_profiles_consent_by_profiles_id_fkey" FOREIGN KEY ("consent_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "health_screenings" ADD CONSTRAINT "health_screenings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "health_screenings" ADD CONSTRAINT "health_screenings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "health_screenings" ADD CONSTRAINT "health_screenings_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "health_screenings" ADD CONSTRAINT "health_screenings_campaign_id_health_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "health_campaigns"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reported_by_profiles_id_fkey" FOREIGN KEY ("reported_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_visit_id_clinic_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id");--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reviewed_by_profiles_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_plan_id_medication_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "medication_plans"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_visit_id_clinic_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_given_by_profiles_id_fkey" FOREIGN KEY ("given_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "medication_log" ADD CONSTRAINT "medication_log_item_id_inventory_items_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_prescription_file_id_files_id_fkey" FOREIGN KEY ("prescription_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "medication_plans" ADD CONSTRAINT "medication_plans_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_campaign_id_health_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "health_campaigns"("id");--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_card_file_id_files_id_fkey" FOREIGN KEY ("card_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_hostel_id_hostels_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_bed_id_hostel_beds_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "hostel_beds"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_mess_plan_id_mess_plans_id_fkey" FOREIGN KEY ("mess_plan_id") REFERENCES "mess_plans"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_room_fee_item_id_student_fee_items_id_fkey" FOREIGN KEY ("room_fee_item_id") REFERENCES "student_fee_items"("id");--> statement-breakpoint
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_mess_fee_item_id_student_fee_items_id_fkey" FOREIGN KEY ("mess_fee_item_id") REFERENCES "student_fee_items"("id");--> statement-breakpoint
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_hostel_id_hostels_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id");--> statement-breakpoint
ALTER TABLE "hostel_attendance" ADD CONSTRAINT "hostel_attendance_marked_by_profiles_id_fkey" FOREIGN KEY ("marked_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ADD CONSTRAINT "hostel_authorised_people_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ADD CONSTRAINT "hostel_authorised_people_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ADD CONSTRAINT "hostel_authorised_people_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ADD CONSTRAINT "hostel_authorised_people_guardian_id_guardians_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id");--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ADD CONSTRAINT "hostel_authorised_people_photo_file_id_files_id_fkey" FOREIGN KEY ("photo_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "hostel_authorised_people" ADD CONSTRAINT "hostel_authorised_people_added_by_profiles_id_fkey" FOREIGN KEY ("added_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_room_id_hostel_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hostel_rooms"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_going_with_id_hostel_authorised_people_id_fkey" FOREIGN KEY ("going_with_id") REFERENCES "hostel_authorised_people"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_checked_out_by_profiles_id_fkey" FOREIGN KEY ("checked_out_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostel_leave" ADD CONSTRAINT "hostel_leave_checked_in_by_profiles_id_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_hostel_id_hostels_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id");--> statement-breakpoint
ALTER TABLE "hostel_visits" ADD CONSTRAINT "hostel_visits_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostel_visits" ADD CONSTRAINT "hostel_visits_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostel_visits" ADD CONSTRAINT "hostel_visits_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "hostel_visits" ADD CONSTRAINT "hostel_visits_person_id_hostel_authorised_people_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hostel_authorised_people"("id");--> statement-breakpoint
ALTER TABLE "hostel_visits" ADD CONSTRAINT "hostel_visits_allowed_by_profiles_id_fkey" FOREIGN KEY ("allowed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_warden_staff_id_staff_id_fkey" FOREIGN KEY ("warden_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "hostels" ADD CONSTRAINT "hostels_assistant_warden_staff_id_staff_id_fkey" FOREIGN KEY ("assistant_warden_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "mess_menus" ADD CONSTRAINT "mess_menus_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "mess_menus" ADD CONSTRAINT "mess_menus_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "mess_menus" ADD CONSTRAINT "mess_menus_hostel_id_hostels_id_fkey" FOREIGN KEY ("hostel_id") REFERENCES "hostels"("id");--> statement-breakpoint
ALTER TABLE "mess_plans" ADD CONSTRAINT "mess_plans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "mess_plans" ADD CONSTRAINT "mess_plans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_booked_by_staff_id_staff_id_fkey" FOREIGN KEY ("booked_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_category_id_ticket_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reported_by_profiles_id_fkey" FOREIGN KEY ("reported_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assigned_to_staff_id_staff_id_fkey" FOREIGN KEY ("assigned_to_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_merged_into_id_maintenance_tickets_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "maintenance_tickets"("id");--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_schedule_id_preventive_schedules_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "preventive_schedules"("id");--> statement-breakpoint
ALTER TABLE "preventive_schedules" ADD CONSTRAINT "preventive_schedules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "preventive_schedules" ADD CONSTRAINT "preventive_schedules_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "preventive_schedules" ADD CONSTRAINT "preventive_schedules_category_id_ticket_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id");--> statement-breakpoint
ALTER TABLE "preventive_schedules" ADD CONSTRAINT "preventive_schedules_asset_id_assets_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id");--> statement-breakpoint
ALTER TABLE "preventive_schedules" ADD CONSTRAINT "preventive_schedules_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id");--> statement-breakpoint
ALTER TABLE "preventive_schedules" ADD CONSTRAINT "preventive_schedules_assignee_staff_id_staff_id_fkey" FOREIGN KEY ("assignee_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_category_id_ticket_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id");--> statement-breakpoint
ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_assignee_staff_id_staff_id_fkey" FOREIGN KEY ("assignee_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_maintenance_tickets_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "maintenance_tickets"("id");--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_profiles_id_fkey" FOREIGN KEY ("author_id") REFERENCES "profiles"("id");--> statement-breakpoint
CREATE POLICY "drivers_staff" ON "drivers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("drivers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("drivers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fuel_logs_staff" ON "fuel_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fuel_logs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fuel_logs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fuel_logs_branch" ON "fuel_logs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fuel_logs"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fuel_logs"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "route_stops_staff" ON "route_stops" AS PERMISSIVE FOR ALL TO "authenticated" USING ("route_stops"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("route_stops"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "route_stops_member_read" ON "route_stops" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("route_stops"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "route_stops_branch" ON "route_stops" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "route_stops"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "route_stops"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "transport_assignments_staff" ON "transport_assignments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("transport_assignments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("transport_assignments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "transport_assignments_family_read" ON "transport_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("transport_assignments"."org_id" = (select app.org_id()) and "transport_assignments"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "transport_assignments_branch" ON "transport_assignments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "transport_assignments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "transport_assignments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "transport_requests_staff" ON "transport_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("transport_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("transport_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "transport_requests_family_read" ON "transport_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("transport_requests"."org_id" = (select app.org_id()) and "transport_requests"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "transport_requests_family_insert" ON "transport_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("transport_requests"."org_id" = (select app.org_id()) and "transport_requests"."student_id" = any ((select app.student_ids())::uuid[]) and "transport_requests"."status" = 'pending');--> statement-breakpoint
CREATE POLICY "transport_requests_family_update" ON "transport_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("transport_requests"."org_id" = (select app.org_id()) and "transport_requests"."student_id" = any ((select app.student_ids())::uuid[]) and "transport_requests"."status" = 'pending') WITH CHECK ("transport_requests"."org_id" = (select app.org_id()) and "transport_requests"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "transport_requests_branch" ON "transport_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "transport_requests"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "transport_requests"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "transport_routes_staff" ON "transport_routes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("transport_routes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("transport_routes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "transport_routes_branch" ON "transport_routes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "transport_routes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "transport_routes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "trip_events_staff" ON "trip_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ("trip_events"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("trip_events"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "trip_events_family_read" ON "trip_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("trip_events"."org_id" = (select app.org_id()) and "trip_events"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "trip_events_branch" ON "trip_events" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "trip_events"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "trip_events"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "trips_staff" ON "trips" AS PERMISSIVE FOR ALL TO "authenticated" USING ("trips"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("trips"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "trips_member_read" ON "trips" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("trips"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "trips_branch" ON "trips" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "trips"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "trips"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vehicle_locations_staff_read" ON "vehicle_locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("vehicle_locations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vehicle_locations_staff_insert" ON "vehicle_locations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("vehicle_locations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vehicle_locations_branch" ON "vehicle_locations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vehicle_locations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vehicle_locations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vehicle_maintenance_staff" ON "vehicle_maintenance" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vehicle_maintenance"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vehicle_maintenance"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vehicle_maintenance_branch" ON "vehicle_maintenance" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vehicle_maintenance"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vehicle_maintenance"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vehicles_staff" ON "vehicles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vehicles"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vehicles"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vehicles_branch" ON "vehicles" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vehicles"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vehicles"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_categories_staff" ON "library_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_copies_staff" ON "library_copies" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_copies"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_copies"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_copies_branch" ON "library_copies" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_copies"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_copies"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_fines_staff" ON "library_fines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_fines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_fines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_fines_family_read" ON "library_fines" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("library_fines"."org_id" = (select app.org_id()) and "library_fines"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "library_fines_branch" ON "library_fines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_fines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_fines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_items_staff" ON "library_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_items_member_read" ON "library_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("library_items"."org_id" = (select app.org_id()));--> statement-breakpoint
CREATE POLICY "library_loans_staff" ON "library_loans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_loans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_loans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_loans_family_read" ON "library_loans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("library_loans"."org_id" = (select app.org_id()) and "library_loans"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "library_loans_branch" ON "library_loans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_loans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_loans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_members_staff" ON "library_members" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_members"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_members"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_members_family_read" ON "library_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("library_members"."org_id" = (select app.org_id()) and "library_members"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "library_members_branch" ON "library_members" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_members"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_members"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_policies_staff" ON "library_policies" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_policies"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_policies"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_reservations_staff" ON "library_reservations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_reservations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_reservations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_reservations_family_read" ON "library_reservations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("library_reservations"."org_id" = (select app.org_id()) and "library_reservations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "library_reservations_family_insert" ON "library_reservations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("library_reservations"."org_id" = (select app.org_id()) and "library_reservations"."student_id" = any ((select app.student_ids())::uuid[]) and "library_reservations"."status" = 'waiting');--> statement-breakpoint
CREATE POLICY "library_reservations_family_update" ON "library_reservations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("library_reservations"."org_id" = (select app.org_id()) and "library_reservations"."student_id" = any ((select app.student_ids())::uuid[]) and "library_reservations"."status" = 'waiting') WITH CHECK ("library_reservations"."org_id" = (select app.org_id()) and "library_reservations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "library_reservations_branch" ON "library_reservations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_reservations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_reservations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_stock_check_scans_staff" ON "library_stock_check_scans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_stock_check_scans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_stock_check_scans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_stock_check_scans_branch" ON "library_stock_check_scans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_stock_check_scans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_stock_check_scans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "library_stock_checks_staff" ON "library_stock_checks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("library_stock_checks"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("library_stock_checks"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "library_stock_checks_branch" ON "library_stock_checks" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "library_stock_checks"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "library_stock_checks"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "asset_assignments_staff_read" ON "asset_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("asset_assignments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "asset_assignments_staff_insert" ON "asset_assignments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("asset_assignments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "asset_assignments_branch" ON "asset_assignments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "asset_assignments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "asset_assignments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "asset_audits_staff" ON "asset_audits" AS PERMISSIVE FOR ALL TO "authenticated" USING ("asset_audits"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("asset_audits"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "asset_audits_branch" ON "asset_audits" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "asset_audits"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "asset_audits"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "asset_categories_staff" ON "asset_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("asset_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("asset_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "asset_maintenance_staff" ON "asset_maintenance" AS PERMISSIVE FOR ALL TO "authenticated" USING ("asset_maintenance"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("asset_maintenance"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "asset_maintenance_branch" ON "asset_maintenance" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "asset_maintenance"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "asset_maintenance"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "assets_staff" ON "assets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("assets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("assets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "assets_branch" ON "assets" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "assets"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "assets"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "depreciation_runs_staff" ON "depreciation_runs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("depreciation_runs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("depreciation_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "inventory_categories_staff" ON "inventory_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("inventory_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("inventory_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "inventory_items_staff" ON "inventory_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("inventory_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("inventory_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_count_lines_staff" ON "stock_count_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_count_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("stock_count_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_count_lines_branch" ON "stock_count_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "stock_count_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "stock_count_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "stock_counts_staff" ON "stock_counts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_counts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("stock_counts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_counts_branch" ON "stock_counts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "stock_counts"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "stock_counts"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "stock_issue_lines_staff" ON "stock_issue_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_issue_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("stock_issue_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_issue_lines_branch" ON "stock_issue_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "stock_issue_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "stock_issue_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "stock_issue_requests_staff" ON "stock_issue_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_issue_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("stock_issue_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_issue_requests_branch" ON "stock_issue_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "stock_issue_requests"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "stock_issue_requests"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "stock_levels_staff" ON "stock_levels" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_levels"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("stock_levels"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_levels_branch" ON "stock_levels" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "stock_levels"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "stock_levels"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "stock_movements_staff_read" ON "stock_movements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("stock_movements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_movements_staff_insert" ON "stock_movements" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("stock_movements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "stock_movements_branch" ON "stock_movements" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "stock_movements"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "stock_movements"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "stock_transfers_staff" ON "stock_transfers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("stock_transfers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("stock_transfers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "warehouses_staff" ON "warehouses" AS PERMISSIVE FOR ALL TO "authenticated" USING ("warehouses"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("warehouses"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "warehouses_branch" ON "warehouses" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "warehouses"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "warehouses"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "canteen_menus_staff" ON "canteen_menus" AS PERMISSIVE FOR ALL TO "authenticated" USING ("canteen_menus"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("canteen_menus"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "canteen_menus_member_read" ON "canteen_menus" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("canteen_menus"."org_id" = (select app.org_id()) and "canteen_menus"."status" = 'published');--> statement-breakpoint
CREATE POLICY "canteen_menus_branch" ON "canteen_menus" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "canteen_menus"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "canteen_menus"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "shop_outlets_staff" ON "shop_outlets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shop_outlets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shop_outlets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shop_outlets_branch" ON "shop_outlets" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "shop_outlets"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "shop_outlets"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "shop_products_staff" ON "shop_products" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shop_products"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shop_products"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shop_products_member_read" ON "shop_products" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("shop_products"."org_id" = (select app.org_id()) and "shop_products"."is_active" = true);--> statement-breakpoint
CREATE POLICY "shop_returns_staff" ON "shop_returns" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shop_returns"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shop_returns"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shop_returns_branch" ON "shop_returns" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "shop_returns"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "shop_returns"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "shop_sale_lines_staff" ON "shop_sale_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shop_sale_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shop_sale_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shop_sale_lines_branch" ON "shop_sale_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "shop_sale_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "shop_sale_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "shop_sales_staff" ON "shop_sales" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shop_sales"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shop_sales"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shop_sales_family_read" ON "shop_sales" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("shop_sales"."org_id" = (select app.org_id()) and "shop_sales"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "shop_sales_branch" ON "shop_sales" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "shop_sales"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "shop_sales"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "shop_sessions_staff" ON "shop_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("shop_sessions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("shop_sessions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "shop_sessions_branch" ON "shop_sessions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "shop_sessions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "shop_sessions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_wallets_staff" ON "student_wallets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_wallets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_wallets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_wallets_family_read" ON "student_wallets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_wallets"."org_id" = (select app.org_id()) and "student_wallets"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "wallet_transactions_staff_read" ON "wallet_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("wallet_transactions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "wallet_transactions_staff_insert" ON "wallet_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("wallet_transactions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "wallet_transactions_family_read" ON "wallet_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("wallet_transactions"."org_id" = (select app.org_id()) and "wallet_transactions"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "clinic_visits_staff" ON "clinic_visits" AS PERMISSIVE FOR ALL TO "authenticated" USING ("clinic_visits"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("clinic_visits"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "clinic_visits_family_read" ON "clinic_visits" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("clinic_visits"."org_id" = (select app.org_id()) and "clinic_visits"."student_id" = any ((select app.student_ids())::uuid[]) and "clinic_visits"."share_with_family" = true);--> statement-breakpoint
CREATE POLICY "clinic_visits_branch" ON "clinic_visits" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "clinic_visits"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "clinic_visits"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "clinic_visits_cap" ON "clinic_visits" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('health')) or "clinic_visits"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('health')) or "clinic_visits"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "health_campaigns_staff" ON "health_campaigns" AS PERMISSIVE FOR ALL TO "authenticated" USING ("health_campaigns"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("health_campaigns"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "health_campaigns_member_read" ON "health_campaigns" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("health_campaigns"."org_id" = (select app.org_id()) and "health_campaigns"."status" in ('consent_open', 'in_progress', 'completed'));--> statement-breakpoint
CREATE POLICY "health_campaigns_branch" ON "health_campaigns" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "health_campaigns"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "health_campaigns"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "health_consents_staff" ON "health_consents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("health_consents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("health_consents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "health_consents_family_read" ON "health_consents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("health_consents"."org_id" = (select app.org_id()) and "health_consents"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "health_consents_family_update" ON "health_consents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("health_consents"."org_id" = (select app.org_id()) and "health_consents"."student_id" = any ((select app.student_ids())::uuid[])) WITH CHECK ("health_consents"."org_id" = (select app.org_id()) and "health_consents"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "health_consents_branch" ON "health_consents" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "health_consents"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "health_consents"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "health_profiles_staff" ON "health_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("health_profiles"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("health_profiles"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "health_profiles_family_read" ON "health_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("health_profiles"."org_id" = (select app.org_id()) and "health_profiles"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "health_profiles_cap" ON "health_profiles" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('health')))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('health'))));--> statement-breakpoint
CREATE POLICY "health_screenings_staff" ON "health_screenings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("health_screenings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("health_screenings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "health_screenings_family_read" ON "health_screenings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("health_screenings"."org_id" = (select app.org_id()) and "health_screenings"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "health_screenings_branch" ON "health_screenings" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "health_screenings"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "health_screenings"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "health_screenings_cap" ON "health_screenings" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('health')))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('health'))));--> statement-breakpoint
CREATE POLICY "incident_reports_staff" ON "incident_reports" AS PERMISSIVE FOR ALL TO "authenticated" USING ("incident_reports"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("incident_reports"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "incident_reports_family_read" ON "incident_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("incident_reports"."org_id" = (select app.org_id()) and "incident_reports"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "incident_reports_branch" ON "incident_reports" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "incident_reports"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "incident_reports"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "medication_log_staff_read" ON "medication_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("medication_log"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "medication_log_staff_insert" ON "medication_log" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("medication_log"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "medication_log_family_read" ON "medication_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("medication_log"."org_id" = (select app.org_id()) and "medication_log"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "medication_log_branch" ON "medication_log" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "medication_log"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "medication_log"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "medication_log_cap" ON "medication_log" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('health')) or "medication_log"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('health')) or "medication_log"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "medication_plans_staff" ON "medication_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("medication_plans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("medication_plans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "medication_plans_family_read" ON "medication_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("medication_plans"."org_id" = (select app.org_id()) and "medication_plans"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "medication_plans_family_insert" ON "medication_plans" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("medication_plans"."org_id" = (select app.org_id()) and "medication_plans"."student_id" = any ((select app.student_ids())::uuid[]) and "medication_plans"."status" = 'requested');--> statement-breakpoint
CREATE POLICY "medication_plans_branch" ON "medication_plans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "medication_plans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "medication_plans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "medication_plans_cap" ON "medication_plans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('health')))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('health'))));--> statement-breakpoint
CREATE POLICY "vaccinations_staff" ON "vaccinations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vaccinations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vaccinations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vaccinations_family_read" ON "vaccinations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("vaccinations"."org_id" = (select app.org_id()) and "vaccinations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "vaccinations_cap" ON "vaccinations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('health')))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('health'))));--> statement-breakpoint
CREATE POLICY "hostel_allocations_staff" ON "hostel_allocations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_allocations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_allocations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_allocations_family_read" ON "hostel_allocations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hostel_allocations"."org_id" = (select app.org_id()) and "hostel_allocations"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "hostel_allocations_branch" ON "hostel_allocations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_allocations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_allocations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostel_attendance_staff" ON "hostel_attendance" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_attendance"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_attendance"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_attendance_family_read" ON "hostel_attendance" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hostel_attendance"."org_id" = (select app.org_id()) and "hostel_attendance"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "hostel_attendance_branch" ON "hostel_attendance" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_attendance"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_attendance"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostel_authorised_people_staff" ON "hostel_authorised_people" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_authorised_people"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_authorised_people"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_authorised_people_family_read" ON "hostel_authorised_people" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hostel_authorised_people"."org_id" = (select app.org_id()) and "hostel_authorised_people"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "hostel_authorised_people_family_insert" ON "hostel_authorised_people" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("hostel_authorised_people"."org_id" = (select app.org_id()) and "hostel_authorised_people"."student_id" = any ((select app.student_ids())::uuid[]) and "hostel_authorised_people"."is_active" = false);--> statement-breakpoint
CREATE POLICY "hostel_authorised_people_branch" ON "hostel_authorised_people" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_authorised_people"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_authorised_people"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostel_beds_staff" ON "hostel_beds" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_beds"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_beds"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_beds_branch" ON "hostel_beds" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_beds"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_beds"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostel_leave_staff" ON "hostel_leave" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_leave"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_leave"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_leave_family_read" ON "hostel_leave" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hostel_leave"."org_id" = (select app.org_id()) and "hostel_leave"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "hostel_leave_family_insert" ON "hostel_leave" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("hostel_leave"."org_id" = (select app.org_id()) and "hostel_leave"."student_id" = any ((select app.student_ids())::uuid[]) and "hostel_leave"."status" = 'requested');--> statement-breakpoint
CREATE POLICY "hostel_leave_family_update" ON "hostel_leave" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("hostel_leave"."org_id" = (select app.org_id()) and "hostel_leave"."student_id" = any ((select app.student_ids())::uuid[]) and "hostel_leave"."status" in ('requested', 'approved')) WITH CHECK ("hostel_leave"."org_id" = (select app.org_id()) and "hostel_leave"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "hostel_leave_branch" ON "hostel_leave" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_leave"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_leave"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostel_rooms_staff" ON "hostel_rooms" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_rooms"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_rooms"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_rooms_branch" ON "hostel_rooms" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_rooms"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_rooms"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostel_visits_staff" ON "hostel_visits" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostel_visits"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostel_visits"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostel_visits_family_read" ON "hostel_visits" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("hostel_visits"."org_id" = (select app.org_id()) and "hostel_visits"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "hostel_visits_branch" ON "hostel_visits" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_visits"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostel_visits"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "hostels_staff" ON "hostels" AS PERMISSIVE FOR ALL TO "authenticated" USING ("hostels"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("hostels"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "hostels_branch" ON "hostels" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "hostels"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "hostels"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "mess_menus_staff" ON "mess_menus" AS PERMISSIVE FOR ALL TO "authenticated" USING ("mess_menus"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("mess_menus"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "mess_menus_member_read" ON "mess_menus" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("mess_menus"."org_id" = (select app.org_id()) and "mess_menus"."status" = 'published');--> statement-breakpoint
CREATE POLICY "mess_menus_branch" ON "mess_menus" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "mess_menus"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "mess_menus"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "mess_plans_staff" ON "mess_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("mess_plans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("mess_plans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "mess_plans_branch" ON "mess_plans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "mess_plans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "mess_plans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "facility_bookings_staff" ON "facility_bookings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("facility_bookings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("facility_bookings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "facility_bookings_branch" ON "facility_bookings" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "facility_bookings"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "facility_bookings"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "maintenance_tickets_staff" ON "maintenance_tickets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("maintenance_tickets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("maintenance_tickets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "maintenance_tickets_branch" ON "maintenance_tickets" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "maintenance_tickets"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "maintenance_tickets"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "preventive_schedules_staff" ON "preventive_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("preventive_schedules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("preventive_schedules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "preventive_schedules_branch" ON "preventive_schedules" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "preventive_schedules"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "preventive_schedules"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "ticket_assignment_rules_staff" ON "ticket_assignment_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ticket_assignment_rules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ticket_assignment_rules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ticket_assignment_rules_branch" ON "ticket_assignment_rules" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "ticket_assignment_rules"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "ticket_assignment_rules"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "ticket_categories_staff" ON "ticket_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ticket_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("ticket_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ticket_comments_staff_read" ON "ticket_comments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ticket_comments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ticket_comments_staff_insert" ON "ticket_comments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("ticket_comments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "ticket_comments_branch" ON "ticket_comments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "ticket_comments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "ticket_comments"."branch_id" = any ((select app.branch_ids())::uuid[])));

-- Hand-written SQL for Wave 6 (packages/db/src/custom-sql/wave-6.sql)

-- library_items
create or replace function app.words(list text[]) returns text language sql immutable parallel safe as $$ select coalesce(array_to_string(list, ' '), '') $$;
grant execute on function app.words(text[]) to authenticated, service_role;
create index library_items_search on library_items using gin (to_tsvector('simple', coalesce(title, '') || ' ' || app.words(authors) || ' ' || app.words(keywords)));

-- hostel_allocations
alter table hostel_allocations add constraint hostel_allocations_bed_no_overlap exclude using gist (bed_id with =, daterange(from_date, to_date, '[]') with &&) where (deleted_at is null);

-- facility_bookings
alter table facility_bookings add constraint facility_bookings_no_overlap exclude using gist (room_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'approved' and deleted_at is null);
