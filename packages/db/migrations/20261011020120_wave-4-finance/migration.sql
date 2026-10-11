CREATE TABLE "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"cashier_id" uuid NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"opening_float" bigint DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"expected_cash" bigint,
	"counted_cash" bigint,
	"difference" bigint,
	"difference_note" text,
	"deposit_reference" text,
	"status" text DEFAULT 'open' NOT NULL,
	"approved_by" uuid,
	"device_id" uuid,
	CONSTRAINT "cash_sessions_status_chk" CHECK ("status" in ('open', 'closed', 'approved')),
	CONSTRAINT "cash_sessions_opening_float_min" CHECK ("opening_float" >= 0),
	CONSTRAINT "cash_sessions_expected_cash_min" CHECK ("expected_cash" >= 0),
	CONSTRAINT "cash_sessions_counted_cash_min" CHECK ("counted_cash" >= 0),
	CONSTRAINT "cash_sessions_difference_note_needed" CHECK (coalesce("difference", 0) = 0 or "difference_note" is not null)
);
--> statement-breakpoint
ALTER TABLE "cash_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "discount_types" (
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
	"calc" text NOT NULL,
	"value" numeric(12,2) NOT NULL,
	"fee_head_ids" uuid[] NOT NULL,
	"sibling_position" integer,
	"needs_approval" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "discount_types_kind_chk" CHECK ("kind" in ('sibling', 'staff_child', 'merit', 'need_based', 'orphan', 'hafiz', 'custom')),
	CONSTRAINT "discount_types_calc_chk" CHECK ("calc" in ('percent', 'fixed'))
);
--> statement-breakpoint
ALTER TABLE "discount_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"fee_head_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"requested_by" uuid NOT NULL,
	"applied_at" timestamp with time zone,
	CONSTRAINT "fee_adjustments_kind_chk" CHECK ("kind" in ('waiver', 'fine_waiver', 'extra_charge', 'correction', 'write_off')),
	CONSTRAINT "fee_adjustments_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'applied')),
	CONSTRAINT "fee_adjustments_amount_pos" CHECK ("amount" > 0),
	CONSTRAINT "fee_adjustments_reason_len" CHECK (char_length("reason") >= 10)
);
--> statement-breakpoint
ALTER TABLE "fee_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_followups" (
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
	"channel" text NOT NULL,
	"outcome" text NOT NULL,
	"promised_date" date,
	"promised_amount" bigint,
	"note" text,
	"done_by" uuid NOT NULL,
	"done_at" timestamp with time zone NOT NULL,
	CONSTRAINT "fee_followups_channel_chk" CHECK ("channel" in ('call', 'message', 'meeting', 'letter')),
	CONSTRAINT "fee_followups_outcome_chk" CHECK ("outcome" in ('promised', 'no_answer', 'disputed', 'hardship', 'paid', 'other')),
	CONSTRAINT "fee_followups_promised_date_needed" CHECK ("outcome" <> 'promised' or "promised_date" is not null),
	CONSTRAINT "fee_followups_promised_amount_min" CHECK ("promised_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_followups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"billing_month" date NOT NULL,
	"months_covered" integer DEFAULT 1 NOT NULL,
	"grade_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"vouchers_created" integer DEFAULT 0 NOT NULL,
	"amount_total" bigint DEFAULT 0 NOT NULL,
	"skipped" jsonb DEFAULT '[]' NOT NULL,
	"started_by" uuid NOT NULL,
	CONSTRAINT "fee_generation_runs_status_chk" CHECK ("status" in ('previewed', 'running', 'completed', 'completed_with_errors', 'failed')),
	CONSTRAINT "fee_generation_runs_billing_month_first" CHECK (extract(day from "billing_month") = 1),
	CONSTRAINT "fee_generation_runs_months_covered_range" CHECK ("months_covered" between 1 and 4),
	CONSTRAINT "fee_generation_runs_due_date_from" CHECK ("due_date" >= "issue_date"),
	CONSTRAINT "fee_generation_runs_amount_total_min" CHECK ("amount_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_generation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_heads" (
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
	"frequency" text NOT NULL,
	"is_refundable" boolean DEFAULT false NOT NULL,
	"counts_for_advance_tax" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"income_account_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fee_heads_kind_chk" CHECK ("kind" in ('tuition', 'admission', 'security_deposit', 'annual', 'exam', 'transport', 'hostel', 'lab', 'books', 'uniform', 'fine', 'tax', 'rounding', 'other')),
	CONSTRAINT "fee_heads_frequency_chk" CHECK ("frequency" in ('monthly', 'once', 'yearly', 'per_term', 'on_demand'))
);
--> statement-breakpoint
ALTER TABLE "fee_heads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_installment_plans" (
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
	"student_id" uuid,
	"voucher_ids" uuid[] NOT NULL,
	"total" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"note" text,
	CONSTRAINT "fee_installment_plans_status_chk" CHECK ("status" in ('pending', 'active', 'completed', 'defaulted', 'cancelled')),
	CONSTRAINT "fee_installment_plans_total_min" CHECK ("total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_installment_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	CONSTRAINT "fee_installments_status_chk" CHECK ("status" in ('due', 'paid', 'missed')),
	CONSTRAINT "fee_installments_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "fee_installments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"fee_head_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"allocated_on" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"receipt_no" text NOT NULL,
	"device_receipt_code" text,
	"family_id" uuid NOT NULL,
	"student_id" uuid,
	"amount" bigint NOT NULL,
	"allocated" bigint DEFAULT 0 NOT NULL,
	"refunded" bigint DEFAULT 0 NOT NULL,
	"unallocated" bigint GENERATED ALWAYS AS ("fee_payments"."amount" - "fee_payments"."allocated" - "fee_payments"."refunded") STORED,
	"paid_on" date NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"method" text NOT NULL,
	"channel" text,
	"reference" text,
	"bank_account_id" uuid,
	"cash_session_id" uuid,
	"collected_by" uuid,
	"source" text NOT NULL,
	"status" text DEFAULT 'recorded' NOT NULL,
	"reversed_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversal_reason" text,
	"note" text,
	CONSTRAINT "fee_payments_method_chk" CHECK ("method" in ('cash', 'bank_deposit', 'bank_transfer', 'cheque', 'online')),
	CONSTRAINT "fee_payments_source_chk" CHECK ("source" in ('counter', 'online', 'bank_file', 'proof', 'import', 'offline')),
	CONSTRAINT "fee_payments_status_chk" CHECK ("status" in ('recorded', 'pending_clearance', 'bounced', 'reversed')),
	CONSTRAINT "fee_payments_amount_pos" CHECK ("amount" > 0),
	CONSTRAINT "fee_payments_allocated_min" CHECK ("allocated" >= 0),
	CONSTRAINT "fee_payments_refunded_min" CHECK ("refunded" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"refund_no" text NOT NULL,
	"family_id" uuid NOT NULL,
	"student_id" uuid,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"deductions" bigint DEFAULT 0 NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"reason" text NOT NULL,
	"withdrawal_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"paid_on" date,
	"paid_by" uuid,
	"cash_session_id" uuid,
	CONSTRAINT "fee_refunds_kind_chk" CHECK ("kind" in ('security_deposit', 'credit', 'fee')),
	CONSTRAINT "fee_refunds_method_chk" CHECK ("method" in ('cash', 'bank_transfer', 'cheque')),
	CONSTRAINT "fee_refunds_status_chk" CHECK ("status" in ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
	CONSTRAINT "fee_refunds_amount_pos" CHECK ("amount" > 0),
	CONSTRAINT "fee_refunds_deductions_min" CHECK ("deductions" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_structure_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"fee_structure_id" uuid NOT NULL,
	"grade_id" uuid NOT NULL,
	"fee_head_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"charge_months" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	CONSTRAINT "fee_structure_items_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_structure_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"academic_year_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"effective_from" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"increase_percent" numeric(5,2),
	"increase_reason" text,
	"activated_by" uuid,
	CONSTRAINT "fee_structures_status_chk" CHECK ("status" in ('draft', 'active', 'archived')),
	CONSTRAINT "fee_structures_effective_from_first" CHECK (extract(day from "effective_from") = 1)
);
--> statement-breakpoint
ALTER TABLE "fee_structures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_voucher_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"voucher_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"fee_head_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"period_month" date,
	"amount" bigint NOT NULL,
	"student_discount_id" uuid,
	"adjustment_id" uuid,
	"fine_date" date,
	CONSTRAINT "fee_voucher_lines_kind_chk" CHECK ("kind" in ('charge', 'discount', 'fine', 'tax', 'adjustment', 'rounding'))
);
--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fee_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"voucher_no" text NOT NULL,
	"challan_no" text NOT NULL,
	"kind" text DEFAULT 'regular' NOT NULL,
	"student_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"academic_year_id" uuid NOT NULL,
	"billing_month" date NOT NULL,
	"months_covered" integer DEFAULT 1 NOT NULL,
	"period_label" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"total" bigint NOT NULL,
	"paid" bigint DEFAULT 0 NOT NULL,
	"balance" bigint GENERATED ALWAYS AS ("fee_vouchers"."total" - "fee_vouchers"."paid") STORED,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"run_id" uuid,
	"cancelled_reason" text,
	"printed_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fee_vouchers_kind_chk" CHECK ("kind" in ('regular', 'admission', 'on_demand', 'opening')),
	CONSTRAINT "fee_vouchers_status_chk" CHECK ("status" in ('unpaid', 'partial', 'paid', 'cancelled')),
	CONSTRAINT "fee_vouchers_billing_month_first" CHECK (extract(day from "billing_month") = 1),
	CONSTRAINT "fee_vouchers_total_min" CHECK ("total" >= 0),
	CONSTRAINT "fee_vouchers_paid_min" CHECK ("paid" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fee_vouchers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fine_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"branch_id" uuid,
	"calc" text NOT NULL,
	"value" numeric(12,2) NOT NULL,
	"grace_days" integer DEFAULT 0 NOT NULL,
	"cap" bigint,
	"effective_from" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fine_rules_calc_chk" CHECK ("calc" in ('fixed', 'per_day', 'percent')),
	CONSTRAINT "fine_rules_cap_min" CHECK ("cap" >= 0)
);
--> statement-breakpoint
ALTER TABLE "fine_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_proofs" (
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
	"challan_no" text,
	"amount" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"reference" text,
	"file_id" uuid NOT NULL,
	"submitted_by" uuid NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"reject_reason" text,
	"payment_id" uuid,
	CONSTRAINT "payment_proofs_status_chk" CHECK ("status" in ('submitted', 'verified', 'rejected')),
	CONSTRAINT "payment_proofs_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_proofs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_discounts" (
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
	"discount_type_id" uuid NOT NULL,
	"calc" text NOT NULL,
	"value" numeric(12,2) NOT NULL,
	"fee_head_ids" uuid[] NOT NULL,
	"from_month" date NOT NULL,
	"to_month" date NOT NULL,
	"reason" text NOT NULL,
	"staff_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"is_automatic" boolean DEFAULT false NOT NULL,
	CONSTRAINT "student_discounts_calc_chk" CHECK ("calc" in ('percent', 'fixed')),
	CONSTRAINT "student_discounts_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'ended'))
);
--> statement-breakpoint
ALTER TABLE "student_discounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_fee_items" (
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
	"fee_head_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"mode" text DEFAULT 'add' NOT NULL,
	"from_month" date NOT NULL,
	"to_month" date,
	"source" text DEFAULT 'manual' NOT NULL,
	"reason" text,
	CONSTRAINT "student_fee_items_mode_chk" CHECK ("mode" in ('add', 'replace')),
	CONSTRAINT "student_fee_items_source_chk" CHECK ("source" in ('manual', 'transport', 'hostel', 'admission')),
	CONSTRAINT "student_fee_items_amount_min" CHECK ("amount" >= 0),
	CONSTRAINT "student_fee_items_reason_needed" CHECK ("mode" <> 'replace' or "reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "student_fee_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_fee_plans" (
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
	"family_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"fee_structure_id" uuid NOT NULL,
	"billing_from" date NOT NULL,
	"billing_to" date,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	CONSTRAINT "student_fee_plans_status_chk" CHECK ("status" in ('active', 'paused', 'ended')),
	CONSTRAINT "student_fee_plans_billing_from_first" CHECK (extract(day from "billing_from") = 1)
);
--> statement-breakpoint
ALTER TABLE "student_fee_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"bank_account_id" uuid NOT NULL,
	"as_of" date NOT NULL,
	"statement_balance" bigint NOT NULL,
	"ledger_balance" bigint NOT NULL,
	"outstanding_deposits" bigint DEFAULT 0 NOT NULL,
	"outstanding_payments" bigint DEFAULT 0 NOT NULL,
	"difference" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_by" uuid,
	"document_id" uuid,
	CONSTRAINT "bank_reconciliations_status_chk" CHECK ("status" in ('open', 'completed')),
	CONSTRAINT "bank_reconciliations_outstanding_deposits_min" CHECK ("outstanding_deposits" >= 0),
	CONSTRAINT "bank_reconciliations_outstanding_payments_min" CHECK ("outstanding_payments" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bank_statement_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"bank_account_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"layout" text NOT NULL,
	"period_from" date,
	"period_to" date,
	"opening_balance" bigint,
	"closing_balance" bigint,
	"line_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error" text,
	"imported_by" uuid NOT NULL,
	CONSTRAINT "bank_statement_imports_kind_chk" CHECK ("kind" in ('statement', 'collection_report')),
	CONSTRAINT "bank_statement_imports_status_chk" CHECK ("status" in ('uploaded', 'parsed', 'matched', 'failed')),
	CONSTRAINT "bank_statement_imports_opening_balance_min" CHECK ("opening_balance" >= 0),
	CONSTRAINT "bank_statement_imports_closing_balance_min" CHECK ("closing_balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"import_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"txn_date" date NOT NULL,
	"description" text NOT NULL,
	"reference" text,
	"challan_no" text,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"balance" bigint,
	"fingerprint" text NOT NULL,
	"match_status" text DEFAULT 'unmatched' NOT NULL,
	"ignore_reason" text,
	CONSTRAINT "bank_statement_lines_match_status_chk" CHECK ("match_status" in ('unmatched', 'suggested', 'matched', 'ignored')),
	CONSTRAINT "bank_statement_lines_debit_min" CHECK ("debit" >= 0),
	CONSTRAINT "bank_statement_lines_credit_min" CHECK ("credit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gateway_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"provider" text NOT NULL,
	"provider_txn_id" text NOT NULL,
	"kind" text NOT NULL,
	"intent_id" uuid,
	"challan_no" text,
	"amount" bigint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"webhook_event_id" uuid,
	"outcome" text NOT NULL,
	"review_reason" text,
	"payment_id" uuid,
	"settlement_id" uuid,
	CONSTRAINT "gateway_transactions_kind_chk" CHECK ("kind" in ('payment', 'refund', 'chargeback')),
	CONSTRAINT "gateway_transactions_outcome_chk" CHECK ("outcome" in ('applied', 'duplicate', 'review', 'ignored')),
	CONSTRAINT "gateway_transactions_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "gateway_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"intent_no" text NOT NULL,
	"family_id" uuid NOT NULL,
	"purpose" text DEFAULT 'fees' NOT NULL,
	"student_id" uuid,
	"challan_no" text,
	"voucher_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"amount" bigint NOT NULL,
	"service_charge" bigint DEFAULT 0 NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"checkout_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"started_by" uuid,
	"started_from" text NOT NULL,
	"provider_txn_id" text,
	"failure_code" text,
	"failure_message" text,
	"payment_id" uuid,
	CONSTRAINT "payment_intents_purpose_chk" CHECK ("purpose" in ('fees', 'wallet_top_up')),
	CONSTRAINT "payment_intents_provider_chk" CHECK ("provider" in ('jazzcash', 'easypaisa', 'onebill', 'card', 'fake')),
	CONSTRAINT "payment_intents_status_chk" CHECK ("status" in ('created', 'pending', 'succeeded', 'failed', 'expired', 'cancelled')),
	CONSTRAINT "payment_intents_started_from_chk" CHECK ("started_from" in ('parent_app', 'counter_link', 'whatsapp', 'website')),
	CONSTRAINT "payment_intents_student_id_needed" CHECK ("purpose" <> 'wallet_top_up' or "student_id" is not null),
	CONSTRAINT "payment_intents_amount_pos" CHECK ("amount" > 0),
	CONSTRAINT "payment_intents_service_charge_min" CHECK ("service_charge" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payment_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reconciliation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"statement_line_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	CONSTRAINT "reconciliation_matches_target_type_chk" CHECK ("target_type" in ('fee_payment', 'payment_proof', 'settlement', 'vendor_payment', 'salary_transfer', 'journal_entry', 'fee_refund')),
	CONSTRAINT "reconciliation_matches_method_chk" CHECK ("method" in ('exact', 'rule', 'manual')),
	CONSTRAINT "reconciliation_matches_status_chk" CHECK ("status" in ('suggested', 'confirmed', 'rejected')),
	CONSTRAINT "reconciliation_matches_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reconciliation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"bank_account_id" uuid,
	"match_field" text NOT NULL,
	"pattern" text NOT NULL,
	"captures" text NOT NULL,
	"target_type" text,
	"account_id" uuid,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "reconciliation_rules_match_field_chk" CHECK ("match_field" in ('description', 'reference')),
	CONSTRAINT "reconciliation_rules_captures_chk" CHECK ("captures" in ('challan_no', 'receipt_no', 'intent_no', 'settlement_ref', 'none'))
);
--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"provider" text NOT NULL,
	"settlement_ref" text NOT NULL,
	"settlement_date" date NOT NULL,
	"gross" bigint NOT NULL,
	"charges" bigint DEFAULT 0 NOT NULL,
	"tax_on_charges" bigint DEFAULT 0 NOT NULL,
	"net" bigint NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"file_id" uuid,
	CONSTRAINT "settlements_status_chk" CHECK ("status" in ('expected', 'received', 'reconciled', 'disputed')),
	CONSTRAINT "settlements_gross_min" CHECK ("gross" >= 0),
	CONSTRAINT "settlements_charges_min" CHECK ("charges" >= 0),
	CONSTRAINT "settlements_tax_on_charges_min" CHECK ("tax_on_charges" >= 0),
	CONSTRAINT "settlements_net_min" CHECK ("net" >= 0)
);
--> statement-breakpoint
ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "account_mappings" (
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
	"account_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "accounts" (
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
	"type" text NOT NULL,
	"subtype" text NOT NULL,
	"parent_id" uuid,
	"is_group" boolean DEFAULT false NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	CONSTRAINT "accounts_type_chk" CHECK ("type" in ('asset', 'liability', 'equity', 'income', 'expense')),
	CONSTRAINT "accounts_subtype_chk" CHECK ("subtype" in ('cash', 'bank', 'receivable', 'payable', 'clearing', 'inventory', 'fixed_asset', 'depreciation', 'advance', 'deposit_held', 'tax', 'equity', 'retained_earnings', 'income', 'contra_income', 'cost_of_sales', 'expense', 'other'))
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"bank_name" text NOT NULL,
	"bank_branch" text,
	"account_title" text NOT NULL,
	"account_no" text NOT NULL,
	"iban" text,
	"kind" text DEFAULT 'current' NOT NULL,
	"account_id" uuid NOT NULL,
	"branch_id" uuid,
	"is_collection" boolean DEFAULT false NOT NULL,
	"onebill_prefix" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bank_accounts_kind_chk" CHECK ("kind" in ('current', 'savings', 'wallet'))
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cost_centers" (
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
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_centers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fiscal_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"fiscal_year_id" uuid NOT NULL,
	"period_no" integer NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	CONSTRAINT "fiscal_periods_status_chk" CHECK ("status" in ('open', 'closed')),
	CONSTRAINT "fiscal_periods_period_no_range" CHECK ("period_no" between 1 and 12)
);
--> statement-breakpoint
ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closing_entry_id" uuid,
	CONSTRAINT "fiscal_years_status_chk" CHECK ("status" in ('open', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "fiscal_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entry_no" text NOT NULL,
	"journal_id" uuid NOT NULL,
	"branch_id" uuid,
	"entry_date" date NOT NULL,
	"fiscal_period_id" uuid NOT NULL,
	"memo" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"purpose" text DEFAULT 'post' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total" bigint NOT NULL,
	"reverses_entry_id" uuid,
	"reversed_by_entry_id" uuid,
	"approval_request_id" uuid,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	CONSTRAINT "journal_entries_status_chk" CHECK ("status" in ('draft', 'posted', 'reversed')),
	CONSTRAINT "journal_entries_total_min" CHECK ("total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"entry_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"account_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"description" text,
	"cost_center_id" uuid,
	"party_type" text DEFAULT 'none' NOT NULL,
	"party_id" uuid,
	"entry_date" date NOT NULL,
	"is_posted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "journal_lines_party_type_chk" CHECK ("party_type" in ('none', 'family', 'student', 'staff', 'vendor')),
	CONSTRAINT "journal_lines_debit_min" CHECK ("debit" >= 0),
	CONSTRAINT "journal_lines_credit_min" CHECK ("credit" >= 0),
	CONSTRAINT "journal_lines_credit_one_side" CHECK (("debit" > 0) <> ("credit" > 0))
);
--> statement-breakpoint
ALTER TABLE "journal_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "journals" (
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
	"kind" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "journals_kind_chk" CHECK ("kind" in ('general', 'fees', 'cash', 'bank', 'payroll', 'purchases', 'inventory', 'opening', 'closing'))
);
--> statement-breakpoint
ALTER TABLE "journals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"journal_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"lines" jsonb NOT NULL,
	"frequency" text NOT NULL,
	"next_run_on" date NOT NULL,
	"ends_on" date,
	"auto_post" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "recurring_entries_frequency_chk" CHECK ("frequency" in ('monthly', 'quarterly', 'yearly'))
);
--> statement-breakpoint
ALTER TABLE "recurring_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"budget_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"monthly" bigint[] NOT NULL,
	"annual" bigint GENERATED ALWAYS AS ("budget_lines"."monthly"[1] + "budget_lines"."monthly"[2] + "budget_lines"."monthly"[3] + "budget_lines"."monthly"[4] + "budget_lines"."monthly"[5] + "budget_lines"."monthly"[6] + "budget_lines"."monthly"[7] + "budget_lines"."monthly"[8] + "budget_lines"."monthly"[9] + "budget_lines"."monthly"[10] + "budget_lines"."monthly"[11] + "budget_lines"."monthly"[12]) STORED,
	"note" text,
	CONSTRAINT "budget_lines_monthly_twelve" CHECK (cardinality("monthly") = 12)
);
--> statement-breakpoint
ALTER TABLE "budget_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"fiscal_year_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	"check_mode" text DEFAULT 'warn' NOT NULL,
	CONSTRAINT "budgets_status_chk" CHECK ("status" in ('draft', 'approved', 'closed')),
	CONSTRAINT "budgets_check_mode_chk" CHECK ("check_mode" in ('none', 'warn', 'block'))
);
--> statement-breakpoint
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expense_categories" (
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
	"account_id" uuid NOT NULL,
	"needs_receipt" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"expense_no" text NOT NULL,
	"expense_date" date NOT NULL,
	"category_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" bigint NOT NULL,
	"vendor_id" uuid,
	"payee" text,
	"bill_reference" text,
	"paid_from" text NOT NULL,
	"petty_cash_fund_id" uuid,
	"bank_account_id" uuid,
	"payment_reference" text,
	"cost_center_id" uuid,
	"requested_by_staff_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	"paid_at" timestamp with time zone,
	"void_reason" text,
	CONSTRAINT "expenses_paid_from_chk" CHECK ("paid_from" in ('petty_cash', 'cash', 'bank')),
	CONSTRAINT "expenses_status_chk" CHECK ("status" in ('draft', 'pending', 'approved', 'paid', 'rejected', 'void')),
	CONSTRAINT "expenses_amount_pos" CHECK ("amount" > 0),
	CONSTRAINT "expenses_petty_cash_fund_id_needed" CHECK ("paid_from" <> 'petty_cash' or "petty_cash_fund_id" is not null),
	CONSTRAINT "expenses_bank_account_id_needed" CHECK ("paid_from" <> 'bank' or "bank_account_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"grn_no" text NOT NULL,
	"po_id" uuid NOT NULL,
	"received_on" date NOT NULL,
	"received_by" uuid NOT NULL,
	"warehouse_id" uuid,
	"delivery_note_no" text,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "goods_receipts_status_chk" CHECK ("status" in ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "goods_receipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "grn_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"grn_id" uuid NOT NULL,
	"po_line_id" uuid NOT NULL,
	"quantity_received" numeric(12,3) NOT NULL,
	"quantity_rejected" numeric(12,3) DEFAULT '0' NOT NULL,
	"note" text,
	CONSTRAINT "grn_lines_quantity_received_min" CHECK ("quantity_received" >= 0)
);
--> statement-breakpoint
ALTER TABLE "grn_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petty_cash_funds" (
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
	"custodian_staff_id" uuid NOT NULL,
	"float_amount" bigint NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"per_expense_limit" bigint,
	"account_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "petty_cash_funds_float_amount_pos" CHECK ("float_amount" > 0),
	CONSTRAINT "petty_cash_funds_balance_min" CHECK ("balance" >= 0),
	CONSTRAINT "petty_cash_funds_per_expense_limit_min" CHECK ("per_expense_limit" >= 0)
);
--> statement-breakpoint
ALTER TABLE "petty_cash_funds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "petty_cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"branch_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"expense_id" uuid,
	"txn_date" date NOT NULL,
	"note" text,
	CONSTRAINT "petty_cash_transactions_kind_chk" CHECK ("kind" in ('top_up', 'expense', 'return', 'count_adjustment')),
	CONSTRAINT "petty_cash_transactions_balance_after_min" CHECK ("balance_after" >= 0)
);
--> statement-breakpoint
ALTER TABLE "petty_cash_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "po_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"po_id" uuid NOT NULL,
	"item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12,3) NOT NULL,
	"unit" text NOT NULL,
	"unit_price" bigint NOT NULL,
	"tax_percent" numeric(5,2) DEFAULT '0' NOT NULL,
	"account_id" uuid,
	"received_qty" numeric(12,3) DEFAULT '0' NOT NULL,
	"billed_qty" numeric(12,3) DEFAULT '0' NOT NULL,
	CONSTRAINT "po_lines_quantity_pos" CHECK ("quantity" > 0),
	CONSTRAINT "po_lines_unit_price_min" CHECK ("unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "po_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"po_no" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"request_id" uuid,
	"order_date" date NOT NULL,
	"expected_on" date,
	"subtotal" bigint NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"terms" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	"document_id" uuid,
	CONSTRAINT "purchase_orders_status_chk" CHECK ("status" in ('draft', 'pending', 'approved', 'sent', 'partly_received', 'received', 'closed', 'cancelled')),
	CONSTRAINT "purchase_orders_subtotal_min" CHECK ("subtotal" >= 0),
	CONSTRAINT "purchase_orders_tax_min" CHECK ("tax" >= 0),
	CONSTRAINT "purchase_orders_total_min" CHECK ("total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_quotes" (
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
	"vendor_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"delivery_days" integer,
	"file_id" uuid,
	"is_selected" boolean DEFAULT false NOT NULL,
	"selection_reason" text,
	CONSTRAINT "purchase_quotes_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_request_lines" (
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
	"item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(12,3) NOT NULL,
	"unit" text NOT NULL,
	"estimated_price" bigint,
	CONSTRAINT "purchase_request_lines_quantity_pos" CHECK ("quantity" > 0),
	CONSTRAINT "purchase_request_lines_estimated_price_min" CHECK ("estimated_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "purchase_requests" (
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
	"needed_by" date,
	"reason" text NOT NULL,
	"estimated_total" bigint DEFAULT 0 NOT NULL,
	"cost_center_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	CONSTRAINT "purchase_requests_status_chk" CHECK ("status" in ('draft', 'pending', 'approved', 'rejected', 'ordered', 'cancelled')),
	CONSTRAINT "purchase_requests_estimated_total_min" CHECK ("estimated_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"po_line_id" uuid,
	"description" text NOT NULL,
	"account_id" uuid NOT NULL,
	"cost_center_id" uuid,
	"quantity" numeric(12,3) DEFAULT '1' NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "vendor_bill_lines_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"bill_no" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"po_id" uuid,
	"bill_date" date NOT NULL,
	"due_date" date NOT NULL,
	"subtotal" bigint NOT NULL,
	"tax" bigint DEFAULT 0 NOT NULL,
	"total" bigint NOT NULL,
	"paid" bigint DEFAULT 0 NOT NULL,
	"balance" bigint GENERATED ALWAYS AS ("vendor_bills"."total" - "vendor_bills"."paid") STORED,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	"file_id" uuid,
	CONSTRAINT "vendor_bills_status_chk" CHECK ("status" in ('draft', 'pending', 'approved', 'partly_paid', 'paid', 'void')),
	CONSTRAINT "vendor_bills_subtotal_min" CHECK ("subtotal" >= 0),
	CONSTRAINT "vendor_bills_tax_min" CHECK ("tax" >= 0),
	CONSTRAINT "vendor_bills_total_min" CHECK ("total" >= 0),
	CONSTRAINT "vendor_bills_paid_min" CHECK ("paid" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_bills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"bill_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "vendor_payment_allocations_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"payment_no" text NOT NULL,
	"vendor_id" uuid NOT NULL,
	"paid_on" date NOT NULL,
	"gross" bigint NOT NULL,
	"withholding" bigint DEFAULT 0 NOT NULL,
	"net" bigint NOT NULL,
	"method" text NOT NULL,
	"bank_account_id" uuid,
	"reference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"void_reason" text,
	CONSTRAINT "vendor_payments_method_chk" CHECK ("method" in ('cash', 'cheque', 'bank_transfer')),
	CONSTRAINT "vendor_payments_status_chk" CHECK ("status" in ('pending', 'approved', 'paid', 'void')),
	CONSTRAINT "vendor_payments_gross_min" CHECK ("gross" >= 0),
	CONSTRAINT "vendor_payments_withholding_min" CHECK ("withholding" >= 0),
	CONSTRAINT "vendor_payments_net_min" CHECK ("net" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"kind" text DEFAULT 'company' NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"city" text,
	"ntn" text,
	"strn" text,
	"cnic" text,
	"filer_status" text DEFAULT 'unknown' NOT NULL,
	"supply_kind" text DEFAULT 'goods' NOT NULL,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"bank_title" text,
	"bank_iban" text,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	CONSTRAINT "vendors_kind_chk" CHECK ("kind" in ('company', 'individual')),
	CONSTRAINT "vendors_filer_status_chk" CHECK ("filer_status" in ('filer', 'non_filer', 'unknown')),
	CONSTRAINT "vendors_supply_kind_chk" CHECK ("supply_kind" in ('goods', 'services', 'both')),
	CONSTRAINT "vendors_status_chk" CHECK ("status" in ('active', 'blocked'))
);
--> statement-breakpoint
ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "compliance_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"branch_id" uuid,
	"authority" text,
	"reference_no" text,
	"due_date" date NOT NULL,
	"repeats" text DEFAULT 'never' NOT NULL,
	"owner_id" uuid NOT NULL,
	"remind_days" integer[] DEFAULT '{30,7,1}'::integer[] NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"done_on" date,
	"file_id" uuid,
	CONSTRAINT "compliance_items_category_chk" CHECK ("category" in ('registration', 'affiliation', 'safety', 'vehicle', 'labour', 'audit', 'other')),
	CONSTRAINT "compliance_items_repeats_chk" CHECK ("repeats" in ('never', 'monthly', 'quarterly', 'yearly')),
	CONSTRAINT "compliance_items_status_chk" CHECK ("status" in ('upcoming', 'done', 'overdue'))
);
--> statement-breakpoint
ALTER TABLE "compliance_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "statutory_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"branch_id" uuid,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"payment_reference" text,
	"paid_on" date,
	"bank_account_id" uuid,
	"file_id" uuid,
	"working_document_id" uuid,
	"prepared_by" uuid,
	CONSTRAINT "statutory_filings_kind_chk" CHECK ("kind" in ('salary_tax_deposit', 'fee_advance_tax_deposit', 'vendor_withholding_deposit', 'withholding_statement', 'eobi_contribution', 'social_security_contribution', 'annual_salary_statement')),
	CONSTRAINT "statutory_filings_status_chk" CHECK ("status" in ('upcoming', 'prepared', 'paid', 'filed', 'overdue')),
	CONSTRAINT "statutory_filings_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "statutory_filings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"kind" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"tax_period" date NOT NULL,
	"base_amount" bigint NOT NULL,
	"tax_amount" bigint NOT NULL,
	"rate_percent" numeric(6,3),
	"rule_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"filing_id" uuid,
	CONSTRAINT "tax_deductions_kind_chk" CHECK ("kind" in ('salary_tax', 'fee_advance_tax', 'vendor_withholding')),
	CONSTRAINT "tax_deductions_party_type_chk" CHECK ("party_type" in ('guardian', 'staff', 'vendor')),
	CONSTRAINT "tax_deductions_tax_period_first" CHECK (extract(day from "tax_period") = 1)
);
--> statement-breakpoint
ALTER TABLE "tax_deductions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_party_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"user_id" uuid,
	"ntn" text,
	"cnic" text,
	"filer_status" text DEFAULT 'unknown' NOT NULL,
	"status_checked_on" date,
	"exemption_file_id" uuid,
	"exemption_valid_to" date,
	CONSTRAINT "tax_party_profiles_party_type_chk" CHECK ("party_type" in ('guardian', 'staff', 'vendor')),
	CONSTRAINT "tax_party_profiles_filer_status_chk" CHECK ("filer_status" in ('filer', 'non_filer', 'unknown'))
);
--> statement-breakpoint
ALTER TABLE "tax_party_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"legal_name" text NOT NULL,
	"ntn" text,
	"strn" text,
	"tax_office" text,
	"tax_year_start_month" integer DEFAULT 7 NOT NULL,
	"withholding_agent" boolean DEFAULT true NOT NULL,
	"eobi_registration_no" text,
	"social_security_no" text,
	"adviser_name" text,
	"adviser_phone" text
);
--> statement-breakpoint
ALTER TABLE "tax_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"province" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"params" jsonb NOT NULL,
	"source_note" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "tax_rules_kind_chk" CHECK ("kind" in ('salary_tax', 'fee_advance_tax', 'vendor_withholding', 'eobi', 'social_security', 'provident_fund', 'minimum_wage')),
	CONSTRAINT "tax_rules_status_chk" CHECK ("status" in ('draft', 'confirmed', 'retired'))
);
--> statement-breakpoint
ALTER TABLE "tax_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "withholding_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"certificate_no" text NOT NULL,
	"kind" text NOT NULL,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"user_id" uuid,
	"tax_year" integer NOT NULL,
	"base_total" bigint NOT NULL,
	"tax_total" bigint NOT NULL,
	"document_id" uuid,
	"issued_on" date NOT NULL,
	"issued_by" uuid NOT NULL,
	CONSTRAINT "withholding_certificates_kind_chk" CHECK ("kind" in ('salary_tax', 'fee_advance_tax', 'vendor_withholding')),
	CONSTRAINT "withholding_certificates_party_type_chk" CHECK ("party_type" in ('guardian', 'staff', 'vendor')),
	CONSTRAINT "withholding_certificates_base_total_min" CHECK ("base_total" >= 0),
	CONSTRAINT "withholding_certificates_tax_total_min" CHECK ("tax_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "withholding_certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_sessions_cashier_uq" ON "cash_sessions" ("cashier_id") WHERE "deleted_at" is null and "status" = 'open';--> statement-breakpoint
CREATE INDEX "cash_sessions_branch_id_fk_idx" ON "cash_sessions" ("branch_id");--> statement-breakpoint
CREATE INDEX "cash_sessions_approved_by_fk_idx" ON "cash_sessions" ("approved_by") WHERE "approved_by" is not null;--> statement-breakpoint
CREATE INDEX "cash_sessions_device_id_fk_idx" ON "cash_sessions" ("device_id") WHERE "device_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_types_name_uq" ON "discount_types" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fee_adjustments_branch_id_fk_idx" ON "fee_adjustments" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_adjustments_voucher_id_fk_idx" ON "fee_adjustments" ("voucher_id");--> statement-breakpoint
CREATE INDEX "fee_adjustments_fee_head_id_fk_idx" ON "fee_adjustments" ("fee_head_id");--> statement-breakpoint
CREATE INDEX "fee_adjustments_approval_request_id_fk_idx" ON "fee_adjustments" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_adjustments_requested_by_fk_idx" ON "fee_adjustments" ("requested_by");--> statement-breakpoint
CREATE INDEX "fee_followups_branch_id_fk_idx" ON "fee_followups" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_followups_family_id_fk_idx" ON "fee_followups" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_followups_done_by_fk_idx" ON "fee_followups" ("done_by");--> statement-breakpoint
CREATE INDEX "fee_generation_runs_branch_id_fk_idx" ON "fee_generation_runs" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_generation_runs_started_by_fk_idx" ON "fee_generation_runs" ("started_by");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_heads_name_uq" ON "fee_heads" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_heads_code_uq" ON "fee_heads" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fee_heads_income_account_id_fk_idx" ON "fee_heads" ("income_account_id") WHERE "income_account_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_installment_plans_branch_id_fk_idx" ON "fee_installment_plans" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_installment_plans_family_id_fk_idx" ON "fee_installment_plans" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_installment_plans_student_id_fk_idx" ON "fee_installment_plans" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_installment_plans_approval_request_id_fk_idx" ON "fee_installment_plans" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_installments_branch_id_fk_idx" ON "fee_installments" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_installments_plan_id_fk_idx" ON "fee_installments" ("plan_id");--> statement-breakpoint
CREATE INDEX "fee_installments_family_id_fk_idx" ON "fee_installments" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_voucher_idx" ON "fee_payment_allocations" ("org_id","voucher_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_payment_idx" ON "fee_payment_allocations" ("org_id","payment_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_branch_id_fk_idx" ON "fee_payment_allocations" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_payment_id_fk_idx" ON "fee_payment_allocations" ("payment_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_voucher_id_fk_idx" ON "fee_payment_allocations" ("voucher_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_fee_head_id_fk_idx" ON "fee_payment_allocations" ("fee_head_id");--> statement-breakpoint
CREATE INDEX "fee_payment_allocations_family_id_fk_idx" ON "fee_payment_allocations" ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_receipt_no_uq" ON "fee_payments" ("org_id","receipt_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_channel_reference_uq" ON "fee_payments" ("org_id","channel","reference") WHERE "deleted_at" is null and "method" = 'online';--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_device_receipt_code_uq" ON "fee_payments" ("org_id","device_receipt_code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fee_payments_branch_paid_on_idx" ON "fee_payments" ("org_id","branch_id","paid_on");--> statement-breakpoint
CREATE INDEX "fee_payments_family_idx" ON "fee_payments" ("org_id","family_id");--> statement-breakpoint
CREATE INDEX "fee_payments_cash_session_idx" ON "fee_payments" ("org_id","cash_session_id");--> statement-breakpoint
CREATE INDEX "fee_payments_branch_id_fk_idx" ON "fee_payments" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_payments_family_id_fk_idx" ON "fee_payments" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_payments_student_id_fk_idx" ON "fee_payments" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_payments_bank_account_id_fk_idx" ON "fee_payments" ("bank_account_id") WHERE "bank_account_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_payments_cash_session_id_fk_idx" ON "fee_payments" ("cash_session_id") WHERE "cash_session_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_payments_collected_by_fk_idx" ON "fee_payments" ("collected_by") WHERE "collected_by" is not null;--> statement-breakpoint
CREATE INDEX "fee_payments_reversed_by_fk_idx" ON "fee_payments" ("reversed_by") WHERE "reversed_by" is not null;--> statement-breakpoint
CREATE INDEX "fee_refunds_branch_id_fk_idx" ON "fee_refunds" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_refunds_family_id_fk_idx" ON "fee_refunds" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_refunds_student_id_fk_idx" ON "fee_refunds" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_refunds_withdrawal_id_fk_idx" ON "fee_refunds" ("withdrawal_id") WHERE "withdrawal_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_refunds_approval_request_id_fk_idx" ON "fee_refunds" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_refunds_paid_by_fk_idx" ON "fee_refunds" ("paid_by") WHERE "paid_by" is not null;--> statement-breakpoint
CREATE INDEX "fee_refunds_cash_session_id_fk_idx" ON "fee_refunds" ("cash_session_id") WHERE "cash_session_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structure_items_fee_structure_grade_fee_head_uq" ON "fee_structure_items" ("fee_structure_id","grade_id","fee_head_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fee_structure_items_grade_id_fk_idx" ON "fee_structure_items" ("grade_id");--> statement-breakpoint
CREATE INDEX "fee_structure_items_fee_head_id_fk_idx" ON "fee_structure_items" ("fee_head_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structures_academic_year_branch_effective_from_uq" ON "fee_structures" ("academic_year_id",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid),"effective_from") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fee_structures_branch_id_fk_idx" ON "fee_structures" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_structures_activated_by_fk_idx" ON "fee_structures" ("activated_by") WHERE "activated_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_voucher_lines_voucher_kind_fine_date_uq" ON "fee_voucher_lines" ("voucher_id","kind",coalesce("fine_date", '0001-01-01'::date)) WHERE "kind" = 'fine';--> statement-breakpoint
CREATE INDEX "fee_voucher_lines_branch_id_fk_idx" ON "fee_voucher_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_voucher_lines_family_id_fk_idx" ON "fee_voucher_lines" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_voucher_lines_fee_head_id_fk_idx" ON "fee_voucher_lines" ("fee_head_id");--> statement-breakpoint
CREATE INDEX "fee_voucher_lines_student_discount_id_fk_idx" ON "fee_voucher_lines" ("student_discount_id") WHERE "student_discount_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_voucher_lines_adjustment_id_fk_idx" ON "fee_voucher_lines" ("adjustment_id") WHERE "adjustment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_vouchers_voucher_no_uq" ON "fee_vouchers" ("org_id","voucher_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_vouchers_student_billing_month_kind_uq" ON "fee_vouchers" ("student_id","billing_month","kind") WHERE "deleted_at" is null and "status" <> 'cancelled' and "kind" = 'regular';--> statement-breakpoint
CREATE INDEX "fee_vouchers_branch_status_due_date_idx" ON "fee_vouchers" ("org_id","branch_id","status","due_date");--> statement-breakpoint
CREATE INDEX "fee_vouchers_family_status_idx" ON "fee_vouchers" ("org_id","family_id","status");--> statement-breakpoint
CREATE INDEX "fee_vouchers_challan_no_idx" ON "fee_vouchers" ("org_id","challan_no");--> statement-breakpoint
CREATE INDEX "fee_vouchers_branch_id_fk_idx" ON "fee_vouchers" ("branch_id");--> statement-breakpoint
CREATE INDEX "fee_vouchers_family_id_fk_idx" ON "fee_vouchers" ("family_id");--> statement-breakpoint
CREATE INDEX "fee_vouchers_enrollment_id_fk_idx" ON "fee_vouchers" ("enrollment_id") WHERE "enrollment_id" is not null;--> statement-breakpoint
CREATE INDEX "fee_vouchers_academic_year_id_fk_idx" ON "fee_vouchers" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "fee_vouchers_run_id_fk_idx" ON "fee_vouchers" ("run_id") WHERE "run_id" is not null;--> statement-breakpoint
CREATE INDEX "fine_rules_branch_id_fk_idx" ON "fine_rules" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_proofs_branch_id_fk_idx" ON "payment_proofs" ("branch_id");--> statement-breakpoint
CREATE INDEX "payment_proofs_family_id_fk_idx" ON "payment_proofs" ("family_id");--> statement-breakpoint
CREATE INDEX "payment_proofs_file_id_fk_idx" ON "payment_proofs" ("file_id");--> statement-breakpoint
CREATE INDEX "payment_proofs_submitted_by_fk_idx" ON "payment_proofs" ("submitted_by");--> statement-breakpoint
CREATE INDEX "payment_proofs_verified_by_fk_idx" ON "payment_proofs" ("verified_by") WHERE "verified_by" is not null;--> statement-breakpoint
CREATE INDEX "payment_proofs_payment_id_fk_idx" ON "payment_proofs" ("payment_id") WHERE "payment_id" is not null;--> statement-breakpoint
CREATE INDEX "student_discounts_student_status_idx" ON "student_discounts" ("org_id","student_id","status");--> statement-breakpoint
CREATE INDEX "student_discounts_branch_id_fk_idx" ON "student_discounts" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_discounts_student_id_fk_idx" ON "student_discounts" ("student_id");--> statement-breakpoint
CREATE INDEX "student_discounts_discount_type_id_fk_idx" ON "student_discounts" ("discount_type_id");--> statement-breakpoint
CREATE INDEX "student_discounts_staff_id_fk_idx" ON "student_discounts" ("staff_id") WHERE "staff_id" is not null;--> statement-breakpoint
CREATE INDEX "student_discounts_approval_request_id_fk_idx" ON "student_discounts" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "student_fee_items_student_from_month_idx" ON "student_fee_items" ("org_id","student_id","from_month");--> statement-breakpoint
CREATE INDEX "student_fee_items_branch_id_fk_idx" ON "student_fee_items" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_fee_items_student_id_fk_idx" ON "student_fee_items" ("student_id");--> statement-breakpoint
CREATE INDEX "student_fee_items_fee_head_id_fk_idx" ON "student_fee_items" ("fee_head_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_fee_plans_student_academic_year_uq" ON "student_fee_plans" ("student_id","academic_year_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "student_fee_plans_branch_id_fk_idx" ON "student_fee_plans" ("branch_id");--> statement-breakpoint
CREATE INDEX "student_fee_plans_family_id_fk_idx" ON "student_fee_plans" ("family_id");--> statement-breakpoint
CREATE INDEX "student_fee_plans_academic_year_id_fk_idx" ON "student_fee_plans" ("academic_year_id");--> statement-breakpoint
CREATE INDEX "student_fee_plans_fee_structure_id_fk_idx" ON "student_fee_plans" ("fee_structure_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_reconciliations_bank_account_as_of_uq" ON "bank_reconciliations" ("bank_account_id","as_of") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "bank_reconciliations_completed_by_fk_idx" ON "bank_reconciliations" ("completed_by") WHERE "completed_by" is not null;--> statement-breakpoint
CREATE INDEX "bank_reconciliations_document_id_fk_idx" ON "bank_reconciliations" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "bank_statement_imports_bank_account_id_fk_idx" ON "bank_statement_imports" ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_statement_imports_file_id_fk_idx" ON "bank_statement_imports" ("file_id");--> statement-breakpoint
CREATE INDEX "bank_statement_imports_imported_by_fk_idx" ON "bank_statement_imports" ("imported_by");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_statement_lines_bank_account_fingerprint_uq" ON "bank_statement_lines" ("bank_account_id","fingerprint") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "bank_statement_lines_bank_account_txn_date_idx" ON "bank_statement_lines" ("org_id","bank_account_id","txn_date");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_match_status_idx" ON "bank_statement_lines" ("org_id","match_status");--> statement-breakpoint
CREATE INDEX "bank_statement_lines_import_id_fk_idx" ON "bank_statement_lines" ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_transactions_provider_provider_txn_kind_uq" ON "gateway_transactions" ("org_id","provider","provider_txn_id","kind");--> statement-breakpoint
CREATE INDEX "gateway_transactions_intent_id_fk_idx" ON "gateway_transactions" ("intent_id") WHERE "intent_id" is not null;--> statement-breakpoint
CREATE INDEX "gateway_transactions_webhook_event_id_fk_idx" ON "gateway_transactions" ("webhook_event_id") WHERE "webhook_event_id" is not null;--> statement-breakpoint
CREATE INDEX "gateway_transactions_payment_id_fk_idx" ON "gateway_transactions" ("payment_id") WHERE "payment_id" is not null;--> statement-breakpoint
CREATE INDEX "gateway_transactions_settlement_id_fk_idx" ON "gateway_transactions" ("settlement_id") WHERE "settlement_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intents_intent_no_uq" ON "payment_intents" ("org_id","intent_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "payment_intents_status_expires_at_idx" ON "payment_intents" ("org_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "payment_intents_family_idx" ON "payment_intents" ("org_id","family_id");--> statement-breakpoint
CREATE INDEX "payment_intents_branch_id_fk_idx" ON "payment_intents" ("branch_id");--> statement-breakpoint
CREATE INDEX "payment_intents_family_id_fk_idx" ON "payment_intents" ("family_id");--> statement-breakpoint
CREATE INDEX "payment_intents_student_id_fk_idx" ON "payment_intents" ("student_id") WHERE "student_id" is not null;--> statement-breakpoint
CREATE INDEX "payment_intents_started_by_fk_idx" ON "payment_intents" ("started_by") WHERE "started_by" is not null;--> statement-breakpoint
CREATE INDEX "payment_intents_payment_id_fk_idx" ON "payment_intents" ("payment_id") WHERE "payment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_matches_statement_line_target_type_target_uq" ON "reconciliation_matches" ("statement_line_id","target_type","target_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "reconciliation_matches_decided_by_fk_idx" ON "reconciliation_matches" ("decided_by") WHERE "decided_by" is not null;--> statement-breakpoint
CREATE INDEX "reconciliation_rules_bank_account_id_fk_idx" ON "reconciliation_rules" ("bank_account_id") WHERE "bank_account_id" is not null;--> statement-breakpoint
CREATE INDEX "reconciliation_rules_account_id_fk_idx" ON "reconciliation_rules" ("account_id") WHERE "account_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_provider_settlement_ref_uq" ON "settlements" ("org_id","provider","settlement_ref") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "settlements_bank_account_id_fk_idx" ON "settlements" ("bank_account_id");--> statement-breakpoint
CREATE INDEX "settlements_file_id_fk_idx" ON "settlements" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "account_mappings_key_branch_uq" ON "account_mappings" ("key",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "account_mappings_branch_id_fk_idx" ON "account_mappings" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "account_mappings_account_id_fk_idx" ON "account_mappings" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_code_uq" ON "accounts" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "accounts_type_code_idx" ON "accounts" ("org_id","type","code");--> statement-breakpoint
CREATE INDEX "accounts_parent_id_fk_idx" ON "accounts" ("parent_id") WHERE "parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_name_uq" ON "bank_accounts" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_account_uq" ON "bank_accounts" ("account_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "bank_accounts_branch_id_fk_idx" ON "bank_accounts" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_centers_code_uq" ON "cost_centers" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "cost_centers_parent_id_fk_idx" ON "cost_centers" ("parent_id") WHERE "parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_periods_fiscal_year_period_no_uq" ON "fiscal_periods" ("fiscal_year_id","period_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fiscal_periods_closed_by_fk_idx" ON "fiscal_periods" ("closed_by") WHERE "closed_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_years_name_uq" ON "fiscal_years" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "fiscal_years_closing_entry_id_fk_idx" ON "fiscal_years" ("closing_entry_id") WHERE "closing_entry_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_entry_no_uq" ON "journal_entries" ("org_id","entry_no") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_source_type_source_purpose_uq" ON "journal_entries" ("org_id","source_type","source_id","purpose") WHERE "deleted_at" is null and "source_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_entry_date_idx" ON "journal_entries" ("org_id","entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_journal_entry_date_idx" ON "journal_entries" ("org_id","journal_id","entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_journal_id_fk_idx" ON "journal_entries" ("journal_id");--> statement-breakpoint
CREATE INDEX "journal_entries_branch_id_fk_idx" ON "journal_entries" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_fiscal_period_id_fk_idx" ON "journal_entries" ("fiscal_period_id");--> statement-breakpoint
CREATE INDEX "journal_entries_reverses_entry_id_fk_idx" ON "journal_entries" ("reverses_entry_id") WHERE "reverses_entry_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_reversed_by_entry_id_fk_idx" ON "journal_entries" ("reversed_by_entry_id") WHERE "reversed_by_entry_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_approval_request_id_fk_idx" ON "journal_entries" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_posted_by_fk_idx" ON "journal_entries" ("posted_by") WHERE "posted_by" is not null;--> statement-breakpoint
CREATE INDEX "journal_lines_account_entry_date_idx" ON "journal_lines" ("org_id","account_id","entry_date");--> statement-breakpoint
CREATE INDEX "journal_lines_branch_account_entry_date_idx" ON "journal_lines" ("org_id","branch_id","account_id","entry_date");--> statement-breakpoint
CREATE INDEX "journal_lines_party_type_party_idx" ON "journal_lines" ("org_id","party_type","party_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_id_fk_idx" ON "journal_lines" ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_account_id_fk_idx" ON "journal_lines" ("account_id");--> statement-breakpoint
CREATE INDEX "journal_lines_branch_id_fk_idx" ON "journal_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "journal_lines_cost_center_id_fk_idx" ON "journal_lines" ("cost_center_id") WHERE "cost_center_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "journals_code_uq" ON "journals" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "recurring_entries_journal_id_fk_idx" ON "recurring_entries" ("journal_id");--> statement-breakpoint
CREATE INDEX "recurring_entries_branch_id_fk_idx" ON "recurring_entries" ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_lines_budget_account_cost_center_uq" ON "budget_lines" ("budget_id","account_id",coalesce("cost_center_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "budget_lines_account_id_fk_idx" ON "budget_lines" ("account_id");--> statement-breakpoint
CREATE INDEX "budget_lines_cost_center_id_fk_idx" ON "budget_lines" ("cost_center_id") WHERE "cost_center_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_fiscal_year_branch_uq" ON "budgets" ("fiscal_year_id",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "deleted_at" is null and "status" = 'approved';--> statement-breakpoint
CREATE INDEX "budgets_branch_id_fk_idx" ON "budgets" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "budgets_approval_request_id_fk_idx" ON "budgets" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_uq" ON "expense_categories" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "expense_categories_account_id_fk_idx" ON "expense_categories" ("account_id");--> statement-breakpoint
CREATE INDEX "expenses_branch_expense_date_idx" ON "expenses" ("org_id","branch_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_expense_date_idx" ON "expenses" ("org_id","category_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_branch_id_fk_idx" ON "expenses" ("branch_id");--> statement-breakpoint
CREATE INDEX "expenses_category_id_fk_idx" ON "expenses" ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_vendor_id_fk_idx" ON "expenses" ("vendor_id") WHERE "vendor_id" is not null;--> statement-breakpoint
CREATE INDEX "expenses_petty_cash_fund_id_fk_idx" ON "expenses" ("petty_cash_fund_id") WHERE "petty_cash_fund_id" is not null;--> statement-breakpoint
CREATE INDEX "expenses_bank_account_id_fk_idx" ON "expenses" ("bank_account_id") WHERE "bank_account_id" is not null;--> statement-breakpoint
CREATE INDEX "expenses_cost_center_id_fk_idx" ON "expenses" ("cost_center_id") WHERE "cost_center_id" is not null;--> statement-breakpoint
CREATE INDEX "expenses_requested_by_staff_id_fk_idx" ON "expenses" ("requested_by_staff_id") WHERE "requested_by_staff_id" is not null;--> statement-breakpoint
CREATE INDEX "expenses_approval_request_id_fk_idx" ON "expenses" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "goods_receipts_branch_id_fk_idx" ON "goods_receipts" ("branch_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_po_id_fk_idx" ON "goods_receipts" ("po_id");--> statement-breakpoint
CREATE INDEX "goods_receipts_received_by_fk_idx" ON "goods_receipts" ("received_by");--> statement-breakpoint
CREATE INDEX "grn_lines_branch_id_fk_idx" ON "grn_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "grn_lines_grn_id_fk_idx" ON "grn_lines" ("grn_id");--> statement-breakpoint
CREATE INDEX "grn_lines_po_line_id_fk_idx" ON "grn_lines" ("po_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "petty_cash_funds_branch_name_uq" ON "petty_cash_funds" ("branch_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "petty_cash_funds_custodian_staff_id_fk_idx" ON "petty_cash_funds" ("custodian_staff_id");--> statement-breakpoint
CREATE INDEX "petty_cash_funds_account_id_fk_idx" ON "petty_cash_funds" ("account_id");--> statement-breakpoint
CREATE INDEX "petty_cash_transactions_branch_id_fk_idx" ON "petty_cash_transactions" ("branch_id");--> statement-breakpoint
CREATE INDEX "petty_cash_transactions_fund_id_fk_idx" ON "petty_cash_transactions" ("fund_id");--> statement-breakpoint
CREATE INDEX "petty_cash_transactions_expense_id_fk_idx" ON "petty_cash_transactions" ("expense_id") WHERE "expense_id" is not null;--> statement-breakpoint
CREATE INDEX "po_lines_branch_id_fk_idx" ON "po_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "po_lines_po_id_fk_idx" ON "po_lines" ("po_id");--> statement-breakpoint
CREATE INDEX "po_lines_account_id_fk_idx" ON "po_lines" ("account_id") WHERE "account_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_orders_branch_id_fk_idx" ON "purchase_orders" ("branch_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_vendor_id_fk_idx" ON "purchase_orders" ("vendor_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_request_id_fk_idx" ON "purchase_orders" ("request_id") WHERE "request_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_orders_approval_request_id_fk_idx" ON "purchase_orders" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_orders_document_id_fk_idx" ON "purchase_orders" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_quotes_request_vendor_uq" ON "purchase_quotes" ("request_id","vendor_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "purchase_quotes_branch_id_fk_idx" ON "purchase_quotes" ("branch_id");--> statement-breakpoint
CREATE INDEX "purchase_quotes_vendor_id_fk_idx" ON "purchase_quotes" ("vendor_id");--> statement-breakpoint
CREATE INDEX "purchase_quotes_file_id_fk_idx" ON "purchase_quotes" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_request_lines_branch_id_fk_idx" ON "purchase_request_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "purchase_request_lines_request_id_fk_idx" ON "purchase_request_lines" ("request_id");--> statement-breakpoint
CREATE INDEX "purchase_requests_branch_id_fk_idx" ON "purchase_requests" ("branch_id");--> statement-breakpoint
CREATE INDEX "purchase_requests_requested_by_staff_id_fk_idx" ON "purchase_requests" ("requested_by_staff_id");--> statement-breakpoint
CREATE INDEX "purchase_requests_cost_center_id_fk_idx" ON "purchase_requests" ("cost_center_id") WHERE "cost_center_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_requests_approval_request_id_fk_idx" ON "purchase_requests" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_branch_id_fk_idx" ON "vendor_bill_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_bill_id_fk_idx" ON "vendor_bill_lines" ("bill_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_po_line_id_fk_idx" ON "vendor_bill_lines" ("po_line_id") WHERE "po_line_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_account_id_fk_idx" ON "vendor_bill_lines" ("account_id");--> statement-breakpoint
CREATE INDEX "vendor_bill_lines_cost_center_id_fk_idx" ON "vendor_bill_lines" ("cost_center_id") WHERE "cost_center_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_bills_vendor_bill_no_uq" ON "vendor_bills" ("org_id","vendor_id","bill_no") WHERE "deleted_at" is null and "status" <> 'void';--> statement-breakpoint
CREATE INDEX "vendor_bills_branch_id_fk_idx" ON "vendor_bills" ("branch_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_vendor_id_fk_idx" ON "vendor_bills" ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_bills_po_id_fk_idx" ON "vendor_bills" ("po_id") WHERE "po_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_bills_approval_request_id_fk_idx" ON "vendor_bills" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_bills_file_id_fk_idx" ON "vendor_bills" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_payment_allocations_payment_bill_uq" ON "vendor_payment_allocations" ("payment_id","bill_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_branch_id_fk_idx" ON "vendor_payment_allocations" ("branch_id");--> statement-breakpoint
CREATE INDEX "vendor_payment_allocations_bill_id_fk_idx" ON "vendor_payment_allocations" ("bill_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_branch_id_fk_idx" ON "vendor_payments" ("branch_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_vendor_id_fk_idx" ON "vendor_payments" ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_payments_bank_account_id_fk_idx" ON "vendor_payments" ("bank_account_id") WHERE "bank_account_id" is not null;--> statement-breakpoint
CREATE INDEX "vendor_payments_approval_request_id_fk_idx" ON "vendor_payments" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_code_uq" ON "vendors" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_ntn_uq" ON "vendors" ("org_id","ntn") WHERE "deleted_at" is null and "ntn" is not null;--> statement-breakpoint
CREATE INDEX "vendors_name_trgm" ON "vendors" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "compliance_items_branch_id_fk_idx" ON "compliance_items" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "compliance_items_owner_id_fk_idx" ON "compliance_items" ("owner_id");--> statement-breakpoint
CREATE INDEX "compliance_items_file_id_fk_idx" ON "compliance_items" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "statutory_filings_kind_branch_period_from_uq" ON "statutory_filings" ("kind",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid),"period_from") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "statutory_filings_branch_id_fk_idx" ON "statutory_filings" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "statutory_filings_bank_account_id_fk_idx" ON "statutory_filings" ("bank_account_id") WHERE "bank_account_id" is not null;--> statement-breakpoint
CREATE INDEX "statutory_filings_file_id_fk_idx" ON "statutory_filings" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "statutory_filings_working_document_id_fk_idx" ON "statutory_filings" ("working_document_id") WHERE "working_document_id" is not null;--> statement-breakpoint
CREATE INDEX "statutory_filings_prepared_by_fk_idx" ON "statutory_filings" ("prepared_by") WHERE "prepared_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_deductions_source_type_source_kind_uq" ON "tax_deductions" ("source_type","source_id","kind") WHERE "tax_amount" > 0;--> statement-breakpoint
CREATE INDEX "tax_deductions_kind_tax_period_idx" ON "tax_deductions" ("org_id","kind","tax_period");--> statement-breakpoint
CREATE INDEX "tax_deductions_party_type_party_tax_period_idx" ON "tax_deductions" ("org_id","party_type","party_id","tax_period");--> statement-breakpoint
CREATE INDEX "tax_deductions_branch_id_fk_idx" ON "tax_deductions" ("branch_id");--> statement-breakpoint
CREATE INDEX "tax_deductions_rule_id_fk_idx" ON "tax_deductions" ("rule_id");--> statement-breakpoint
CREATE INDEX "tax_deductions_filing_id_fk_idx" ON "tax_deductions" ("filing_id") WHERE "filing_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_party_profiles_party_type_party_uq" ON "tax_party_profiles" ("party_type","party_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tax_party_profiles_user_id_fk_idx" ON "tax_party_profiles" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "tax_party_profiles_exemption_file_id_fk_idx" ON "tax_party_profiles" ("exemption_file_id") WHERE "exemption_file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tax_profile_org_uq" ON "tax_profile" ("org_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tax_rules_confirmed_by_fk_idx" ON "tax_rules" ("confirmed_by") WHERE "confirmed_by" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "withholding_certificates_kind_party_type_party_tax_year_uq" ON "withholding_certificates" ("kind","party_type","party_id","tax_year") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "withholding_certificates_user_id_fk_idx" ON "withholding_certificates" ("user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "withholding_certificates_document_id_fk_idx" ON "withholding_certificates" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "withholding_certificates_issued_by_fk_idx" ON "withholding_certificates" ("issued_by");--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cashier_id_profiles_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_approved_by_profiles_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_device_id_sync_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "sync_devices"("id");--> statement-breakpoint
ALTER TABLE "discount_types" ADD CONSTRAINT "discount_types_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_voucher_id_fee_vouchers_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "fee_vouchers"("id");--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_fee_head_id_fee_heads_id_fkey" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id");--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_followups" ADD CONSTRAINT "fee_followups_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_followups" ADD CONSTRAINT "fee_followups_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_followups" ADD CONSTRAINT "fee_followups_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_followups" ADD CONSTRAINT "fee_followups_done_by_profiles_id_fkey" FOREIGN KEY ("done_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_generation_runs" ADD CONSTRAINT "fee_generation_runs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_generation_runs" ADD CONSTRAINT "fee_generation_runs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_generation_runs" ADD CONSTRAINT "fee_generation_runs_started_by_profiles_id_fkey" FOREIGN KEY ("started_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_income_account_id_accounts_id_fkey" FOREIGN KEY ("income_account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "fee_installment_plans" ADD CONSTRAINT "fee_installment_plans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_installment_plans" ADD CONSTRAINT "fee_installment_plans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_installment_plans" ADD CONSTRAINT "fee_installment_plans_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_installment_plans" ADD CONSTRAINT "fee_installment_plans_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "fee_installment_plans" ADD CONSTRAINT "fee_installment_plans_approval_request_id_approval_req_7a093278" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "fee_installments" ADD CONSTRAINT "fee_installments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_installments" ADD CONSTRAINT "fee_installments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_installments" ADD CONSTRAINT "fee_installments_plan_id_fee_installment_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "fee_installment_plans"("id");--> statement-breakpoint
ALTER TABLE "fee_installments" ADD CONSTRAINT "fee_installments_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_payment_id_fee_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id");--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_voucher_id_fee_vouchers_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "fee_vouchers"("id");--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_fee_head_id_fee_heads_id_fkey" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id");--> statement-breakpoint
ALTER TABLE "fee_payment_allocations" ADD CONSTRAINT "fee_payment_allocations_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_cash_session_id_cash_sessions_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_collected_by_profiles_id_fkey" FOREIGN KEY ("collected_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_reversed_by_profiles_id_fkey" FOREIGN KEY ("reversed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_withdrawal_id_student_withdrawals_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "student_withdrawals"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_paid_by_profiles_id_fkey" FOREIGN KEY ("paid_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_cash_session_id_cash_sessions_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id");--> statement-breakpoint
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_fee_structure_id_fee_structures_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id");--> statement-breakpoint
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_grade_id_grades_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id");--> statement-breakpoint
ALTER TABLE "fee_structure_items" ADD CONSTRAINT "fee_structure_items_fee_head_id_fee_heads_id_fkey" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id");--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_activated_by_profiles_id_fkey" FOREIGN KEY ("activated_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_voucher_id_fee_vouchers_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "fee_vouchers"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_fee_head_id_fee_heads_id_fkey" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_student_discount_id_student_discounts_id_fkey" FOREIGN KEY ("student_discount_id") REFERENCES "student_discounts"("id");--> statement-breakpoint
ALTER TABLE "fee_voucher_lines" ADD CONSTRAINT "fee_voucher_lines_adjustment_id_fee_adjustments_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "fee_adjustments"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "fee_vouchers" ADD CONSTRAINT "fee_vouchers_run_id_fee_generation_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fee_generation_runs"("id");--> statement-breakpoint
ALTER TABLE "fine_rules" ADD CONSTRAINT "fine_rules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fine_rules" ADD CONSTRAINT "fine_rules_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_submitted_by_profiles_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_verified_by_profiles_id_fkey" FOREIGN KEY ("verified_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_payment_id_fee_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id");--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_discount_type_id_discount_types_id_fkey" FOREIGN KEY ("discount_type_id") REFERENCES "discount_types"("id");--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "student_discounts" ADD CONSTRAINT "student_discounts_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "student_fee_items" ADD CONSTRAINT "student_fee_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_fee_items" ADD CONSTRAINT "student_fee_items_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_fee_items" ADD CONSTRAINT "student_fee_items_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_fee_items" ADD CONSTRAINT "student_fee_items_fee_head_id_fee_heads_id_fkey" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id");--> statement-breakpoint
ALTER TABLE "student_fee_plans" ADD CONSTRAINT "student_fee_plans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "student_fee_plans" ADD CONSTRAINT "student_fee_plans_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "student_fee_plans" ADD CONSTRAINT "student_fee_plans_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "student_fee_plans" ADD CONSTRAINT "student_fee_plans_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "student_fee_plans" ADD CONSTRAINT "student_fee_plans_academic_year_id_academic_years_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id");--> statement-breakpoint
ALTER TABLE "student_fee_plans" ADD CONSTRAINT "student_fee_plans_fee_structure_id_fee_structures_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id");--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_completed_by_profiles_id_fkey" FOREIGN KEY ("completed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_imports" ADD CONSTRAINT "bank_statement_imports_imported_by_profiles_id_fkey" FOREIGN KEY ("imported_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_import_id_bank_statement_imports_id_fkey" FOREIGN KEY ("import_id") REFERENCES "bank_statement_imports"("id");--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_intent_id_payment_intents_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "payment_intents"("id");--> statement-breakpoint
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_webhook_event_id_webhook_events_id_fkey" FOREIGN KEY ("webhook_event_id") REFERENCES "webhook_events"("id");--> statement-breakpoint
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_payment_id_fee_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id");--> statement-breakpoint
ALTER TABLE "gateway_transactions" ADD CONSTRAINT "gateway_transactions_settlement_id_settlements_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id");--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_family_id_families_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id");--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id");--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_started_by_profiles_id_fkey" FOREIGN KEY ("started_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_payment_id_fee_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fee_payments"("id");--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_statement_line_id_bank_statemen_88b055ae" FOREIGN KEY ("statement_line_id") REFERENCES "bank_statement_lines"("id");--> statement-breakpoint
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_decided_by_profiles_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_accounts_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_parent_id_cost_centers_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_fiscal_year_id_fiscal_years_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id");--> statement-breakpoint
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_closed_by_profiles_id_fkey" FOREIGN KEY ("closed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_closing_entry_id_journal_entries_id_fkey" FOREIGN KEY ("closing_entry_id") REFERENCES "journal_entries"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_id_journals_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscal_period_id_fiscal_periods_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reverses_entry_id_journal_entries_id_fkey" FOREIGN KEY ("reverses_entry_id") REFERENCES "journal_entries"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_by_entry_id_journal_entries_id_fkey" FOREIGN KEY ("reversed_by_entry_id") REFERENCES "journal_entries"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_posted_by_profiles_id_fkey" FOREIGN KEY ("posted_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id");--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_journal_id_journals_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "journals"("id");--> statement-breakpoint
ALTER TABLE "recurring_entries" ADD CONSTRAINT "recurring_entries_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_budgets_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id");--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_fiscal_year_id_fiscal_years_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_petty_cash_fund_id_petty_cash_funds_id_fkey" FOREIGN KEY ("petty_cash_fund_id") REFERENCES "petty_cash_funds"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_requested_by_staff_id_staff_id_fkey" FOREIGN KEY ("requested_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_po_id_purchase_orders_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id");--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_profiles_id_fkey" FOREIGN KEY ("received_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_grn_id_goods_receipts_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "goods_receipts"("id");--> statement-breakpoint
ALTER TABLE "grn_lines" ADD CONSTRAINT "grn_lines_po_line_id_po_lines_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_funds" ADD CONSTRAINT "petty_cash_funds_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_funds" ADD CONSTRAINT "petty_cash_funds_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_funds" ADD CONSTRAINT "petty_cash_funds_custodian_staff_id_staff_id_fkey" FOREIGN KEY ("custodian_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_funds" ADD CONSTRAINT "petty_cash_funds_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_transactions" ADD CONSTRAINT "petty_cash_transactions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_transactions" ADD CONSTRAINT "petty_cash_transactions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_transactions" ADD CONSTRAINT "petty_cash_transactions_fund_id_petty_cash_funds_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "petty_cash_funds"("id");--> statement-breakpoint
ALTER TABLE "petty_cash_transactions" ADD CONSTRAINT "petty_cash_transactions_expense_id_expenses_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id");--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_po_id_purchase_orders_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id");--> statement-breakpoint
ALTER TABLE "po_lines" ADD CONSTRAINT "po_lines_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_request_id_purchase_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_request_id_purchase_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id");--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "purchase_request_lines" ADD CONSTRAINT "purchase_request_lines_request_id_purchase_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id");--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_requested_by_staff_id_staff_id_fkey" FOREIGN KEY ("requested_by_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_bill_id_vendor_bills_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "vendor_bills"("id");--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_po_line_id_po_lines_id_fkey" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id");--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_cost_center_id_cost_centers_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_po_id_purchase_orders_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_payment_id_vendor_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "vendor_payments"("id");--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_bill_id_vendor_bills_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "vendor_bills"("id");--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_vendors_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id");--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "compliance_items" ADD CONSTRAINT "compliance_items_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "statutory_filings" ADD CONSTRAINT "statutory_filings_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "statutory_filings" ADD CONSTRAINT "statutory_filings_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "statutory_filings" ADD CONSTRAINT "statutory_filings_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "statutory_filings" ADD CONSTRAINT "statutory_filings_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "statutory_filings" ADD CONSTRAINT "statutory_filings_working_document_id_generated_docume_4b658104" FOREIGN KEY ("working_document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "statutory_filings" ADD CONSTRAINT "statutory_filings_prepared_by_profiles_id_fkey" FOREIGN KEY ("prepared_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "tax_deductions" ADD CONSTRAINT "tax_deductions_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "tax_deductions" ADD CONSTRAINT "tax_deductions_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "tax_deductions" ADD CONSTRAINT "tax_deductions_rule_id_tax_rules_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "tax_rules"("id");--> statement-breakpoint
ALTER TABLE "tax_deductions" ADD CONSTRAINT "tax_deductions_filing_id_statutory_filings_id_fkey" FOREIGN KEY ("filing_id") REFERENCES "statutory_filings"("id");--> statement-breakpoint
ALTER TABLE "tax_party_profiles" ADD CONSTRAINT "tax_party_profiles_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "tax_party_profiles" ADD CONSTRAINT "tax_party_profiles_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "tax_party_profiles" ADD CONSTRAINT "tax_party_profiles_exemption_file_id_files_id_fkey" FOREIGN KEY ("exemption_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "tax_profile" ADD CONSTRAINT "tax_profile_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_confirmed_by_profiles_id_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_document_id_generated_documen_019f0916" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "withholding_certificates" ADD CONSTRAINT "withholding_certificates_issued_by_profiles_id_fkey" FOREIGN KEY ("issued_by") REFERENCES "profiles"("id");--> statement-breakpoint
CREATE POLICY "cash_sessions_staff" ON "cash_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cash_sessions"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("cash_sessions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "cash_sessions_branch" ON "cash_sessions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "cash_sessions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "cash_sessions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "discount_types_staff" ON "discount_types" AS PERMISSIVE FOR ALL TO "authenticated" USING ("discount_types"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("discount_types"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_adjustments_staff" ON "fee_adjustments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_adjustments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_adjustments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_adjustments_branch" ON "fee_adjustments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_adjustments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_adjustments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_followups_staff" ON "fee_followups" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_followups"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_followups"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_followups_branch" ON "fee_followups" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_followups"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_followups"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_generation_runs_staff" ON "fee_generation_runs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_generation_runs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_generation_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_generation_runs_branch" ON "fee_generation_runs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_generation_runs"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_generation_runs"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_heads_staff" ON "fee_heads" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_heads"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_heads"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_installment_plans_staff" ON "fee_installment_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_installment_plans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_installment_plans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_installment_plans_household_read" ON "fee_installment_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_installment_plans"."org_id" = (select app.org_id()) and "fee_installment_plans"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_installment_plans_branch" ON "fee_installment_plans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_installment_plans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_installment_plans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_installments_staff" ON "fee_installments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_installments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_installments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_installments_household_read" ON "fee_installments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_installments"."org_id" = (select app.org_id()) and "fee_installments"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_installments_branch" ON "fee_installments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_installments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_installments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_payment_allocations_staff_read" ON "fee_payment_allocations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_payment_allocations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_payment_allocations_staff_insert" ON "fee_payment_allocations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("fee_payment_allocations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_payment_allocations_household_read" ON "fee_payment_allocations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_payment_allocations"."org_id" = (select app.org_id()) and "fee_payment_allocations"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_payment_allocations_branch" ON "fee_payment_allocations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_payment_allocations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_payment_allocations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_payments_staff" ON "fee_payments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_payments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_payments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_payments_household_read" ON "fee_payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_payments"."org_id" = (select app.org_id()) and "fee_payments"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_payments_branch" ON "fee_payments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_payments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_payments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_refunds_staff" ON "fee_refunds" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_refunds"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_refunds"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_refunds_household_read" ON "fee_refunds" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_refunds"."org_id" = (select app.org_id()) and "fee_refunds"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_refunds_branch" ON "fee_refunds" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_refunds"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_refunds"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_structure_items_staff" ON "fee_structure_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_structure_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_structure_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_structures_staff" ON "fee_structures" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_structures"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_structures"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_voucher_lines_staff_read" ON "fee_voucher_lines" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_voucher_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_voucher_lines_staff_insert" ON "fee_voucher_lines" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("fee_voucher_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_voucher_lines_household_read" ON "fee_voucher_lines" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_voucher_lines"."org_id" = (select app.org_id()) and "fee_voucher_lines"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_voucher_lines_branch" ON "fee_voucher_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_voucher_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_voucher_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fee_vouchers_staff" ON "fee_vouchers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fee_vouchers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fee_vouchers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fee_vouchers_household_read" ON "fee_vouchers" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("fee_vouchers"."org_id" = (select app.org_id()) and "fee_vouchers"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "fee_vouchers_branch" ON "fee_vouchers" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "fee_vouchers"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "fee_vouchers"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "fine_rules_staff" ON "fine_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fine_rules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fine_rules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payment_proofs_staff" ON "payment_proofs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payment_proofs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("payment_proofs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payment_proofs_household_read" ON "payment_proofs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("payment_proofs"."org_id" = (select app.org_id()) and "payment_proofs"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "payment_proofs_household_insert" ON "payment_proofs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("payment_proofs"."org_id" = (select app.org_id()) and "payment_proofs"."family_id" = (select app.family_id()) and "payment_proofs"."status" = 'submitted');--> statement-breakpoint
CREATE POLICY "payment_proofs_branch" ON "payment_proofs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "payment_proofs"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "payment_proofs"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_discounts_staff" ON "student_discounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_discounts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_discounts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_discounts_family_read" ON "student_discounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_discounts"."org_id" = (select app.org_id()) and "student_discounts"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_discounts_branch" ON "student_discounts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_discounts"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_discounts"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_fee_items_staff" ON "student_fee_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_fee_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_fee_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_fee_items_family_read" ON "student_fee_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_fee_items"."org_id" = (select app.org_id()) and "student_fee_items"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_fee_items_branch" ON "student_fee_items" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_fee_items"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_fee_items"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "student_fee_plans_staff" ON "student_fee_plans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_fee_plans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("student_fee_plans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "student_fee_plans_family_read" ON "student_fee_plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_fee_plans"."org_id" = (select app.org_id()) and "student_fee_plans"."student_id" = any ((select app.student_ids())::uuid[]));--> statement-breakpoint
CREATE POLICY "student_fee_plans_branch" ON "student_fee_plans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "student_fee_plans"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "student_fee_plans"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "bank_reconciliations_staff" ON "bank_reconciliations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bank_reconciliations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bank_reconciliations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bank_statement_imports_staff" ON "bank_statement_imports" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bank_statement_imports"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bank_statement_imports"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bank_statement_lines_staff" ON "bank_statement_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bank_statement_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bank_statement_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "gateway_transactions_staff_read" ON "gateway_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("gateway_transactions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "gateway_transactions_staff_insert" ON "gateway_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("gateway_transactions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payment_intents_staff" ON "payment_intents" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payment_intents"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("payment_intents"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payment_intents_household_read" ON "payment_intents" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("payment_intents"."org_id" = (select app.org_id()) and "payment_intents"."family_id" = (select app.family_id()));--> statement-breakpoint
CREATE POLICY "payment_intents_household_insert" ON "payment_intents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("payment_intents"."org_id" = (select app.org_id()) and "payment_intents"."family_id" = (select app.family_id()) and "payment_intents"."status" = 'created');--> statement-breakpoint
CREATE POLICY "payment_intents_branch" ON "payment_intents" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "payment_intents"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "payment_intents"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "reconciliation_matches_staff" ON "reconciliation_matches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("reconciliation_matches"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("reconciliation_matches"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "reconciliation_rules_staff" ON "reconciliation_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("reconciliation_rules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("reconciliation_rules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "settlements_staff" ON "settlements" AS PERMISSIVE FOR ALL TO "authenticated" USING ("settlements"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("settlements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "account_mappings_staff" ON "account_mappings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("account_mappings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("account_mappings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "accounts_staff" ON "accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("accounts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("accounts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bank_accounts_staff" ON "bank_accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bank_accounts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bank_accounts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "cost_centers_staff" ON "cost_centers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("cost_centers"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("cost_centers"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fiscal_periods_staff" ON "fiscal_periods" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fiscal_periods"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fiscal_periods"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "fiscal_years_staff" ON "fiscal_years" AS PERMISSIVE FOR ALL TO "authenticated" USING ("fiscal_years"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("fiscal_years"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "journal_entries_staff" ON "journal_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("journal_entries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("journal_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "journal_lines_staff" ON "journal_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("journal_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("journal_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "journals_staff" ON "journals" AS PERMISSIVE FOR ALL TO "authenticated" USING ("journals"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("journals"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "recurring_entries_staff" ON "recurring_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ("recurring_entries"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("recurring_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "budget_lines_staff" ON "budget_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("budget_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("budget_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "budgets_staff" ON "budgets" AS PERMISSIVE FOR ALL TO "authenticated" USING ("budgets"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("budgets"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "expense_categories_staff" ON "expense_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("expense_categories"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("expense_categories"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "expenses_staff" ON "expenses" AS PERMISSIVE FOR ALL TO "authenticated" USING ("expenses"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("expenses"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "expenses_branch" ON "expenses" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "expenses"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "expenses"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "goods_receipts_staff" ON "goods_receipts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("goods_receipts"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("goods_receipts"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "goods_receipts_branch" ON "goods_receipts" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "goods_receipts"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "goods_receipts"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "grn_lines_staff" ON "grn_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("grn_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("grn_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "grn_lines_branch" ON "grn_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "grn_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "grn_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "petty_cash_funds_staff" ON "petty_cash_funds" AS PERMISSIVE FOR ALL TO "authenticated" USING ("petty_cash_funds"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("petty_cash_funds"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "petty_cash_funds_branch" ON "petty_cash_funds" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "petty_cash_funds"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "petty_cash_funds"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "petty_cash_transactions_staff_read" ON "petty_cash_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("petty_cash_transactions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "petty_cash_transactions_staff_insert" ON "petty_cash_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("petty_cash_transactions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "petty_cash_transactions_branch" ON "petty_cash_transactions" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "petty_cash_transactions"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "petty_cash_transactions"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "po_lines_staff" ON "po_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("po_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("po_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "po_lines_branch" ON "po_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "po_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "po_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "purchase_orders_staff" ON "purchase_orders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("purchase_orders"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("purchase_orders"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "purchase_orders_branch" ON "purchase_orders" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_orders"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_orders"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "purchase_quotes_staff" ON "purchase_quotes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("purchase_quotes"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("purchase_quotes"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "purchase_quotes_branch" ON "purchase_quotes" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_quotes"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_quotes"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "purchase_request_lines_staff" ON "purchase_request_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("purchase_request_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("purchase_request_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "purchase_request_lines_branch" ON "purchase_request_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_request_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_request_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "purchase_requests_staff" ON "purchase_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("purchase_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("purchase_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "purchase_requests_branch" ON "purchase_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_requests"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "purchase_requests"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vendor_bill_lines_staff" ON "vendor_bill_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vendor_bill_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vendor_bill_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vendor_bill_lines_branch" ON "vendor_bill_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_bill_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_bill_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vendor_bills_staff" ON "vendor_bills" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vendor_bills"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vendor_bills"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vendor_bills_branch" ON "vendor_bills" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_bills"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_bills"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vendor_payment_allocations_staff" ON "vendor_payment_allocations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vendor_payment_allocations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vendor_payment_allocations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vendor_payment_allocations_branch" ON "vendor_payment_allocations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_payment_allocations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_payment_allocations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vendor_payments_staff" ON "vendor_payments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vendor_payments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vendor_payments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "vendor_payments_branch" ON "vendor_payments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_payments"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "vendor_payments"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "vendors_staff" ON "vendors" AS PERMISSIVE FOR ALL TO "authenticated" USING ("vendors"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("vendors"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "compliance_items_staff" ON "compliance_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("compliance_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("compliance_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "statutory_filings_staff" ON "statutory_filings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("statutory_filings"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("statutory_filings"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "tax_deductions_staff_read" ON "tax_deductions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("tax_deductions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "tax_deductions_staff_insert" ON "tax_deductions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("tax_deductions"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "tax_party_profiles_staff" ON "tax_party_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tax_party_profiles"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("tax_party_profiles"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "tax_party_profiles_self" ON "tax_party_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tax_party_profiles"."org_id" = (select app.org_id()) and "tax_party_profiles"."user_id" = (select app.user_id())) WITH CHECK ("tax_party_profiles"."org_id" = (select app.org_id()) and "tax_party_profiles"."user_id" = (select app.user_id()));--> statement-breakpoint
CREATE POLICY "tax_profile_staff" ON "tax_profile" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tax_profile"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("tax_profile"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "tax_rules_staff" ON "tax_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tax_rules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("tax_rules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "withholding_certificates_staff" ON "withholding_certificates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("withholding_certificates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("withholding_certificates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "withholding_certificates_self" ON "withholding_certificates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("withholding_certificates"."org_id" = (select app.org_id()) and "withholding_certificates"."user_id" = (select app.user_id())) WITH CHECK ("withholding_certificates"."org_id" = (select app.org_id()) and "withholding_certificates"."user_id" = (select app.user_id()));

-- Hand-written SQL for Wave 4 (packages/db/src/custom-sql/wave-4.sql)

-- fiscal_years
alter table fiscal_years add constraint fiscal_years_no_overlap exclude using gist (org_id with =, daterange(starts_on, ends_on, '[]') with &&) where (deleted_at is null);

-- journal_lines
create or replace function app.journal_line_guard() returns trigger language plpgsql as $$
begin
  if old.is_posted then
    raise exception 'A posted journal line is a permanent record and cannot be changed or removed' using errcode = 'TK001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;
create trigger journal_lines_posted_fixed before update or delete on journal_lines for each row execute function app.journal_line_guard();
create or replace function app.journal_entry_balances(entry uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from journal_entries e where e.id = entry and e.status = 'posted') then
    return;
  end if;
  if exists (
    select 1 from journal_lines l
    where l.entry_id = entry and l.deleted_at is null
    group by l.branch_id
    having sum(l.debit) <> sum(l.credit)
  ) or not exists (select 1 from journal_lines l where l.entry_id = entry and l.deleted_at is null) then
    raise exception 'Journal entry % does not balance: its debits and credits must be equal within each branch', entry
      using errcode = '23514';
  end if;
end $$;
grant execute on function app.journal_entry_balances(uuid) to authenticated, service_role;
create or replace function app.journal_line_balance_check() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform app.journal_entry_balances(old.entry_id);
  else
    perform app.journal_entry_balances(new.entry_id);
  end if;
  return null;
end $$;
create or replace function app.journal_entry_balance_check() returns trigger language plpgsql as $$
begin
  perform app.journal_entry_balances(new.id);
  return null;
end $$;
create constraint trigger journal_lines_balanced after insert or update or delete on journal_lines deferrable initially deferred for each row execute function app.journal_line_balance_check();
create constraint trigger journal_entries_balanced after insert or update on journal_entries deferrable initially deferred for each row execute function app.journal_entry_balance_check();

-- tax_rules
alter table tax_rules add constraint tax_rules_no_overlap exclude using gist (org_id with =, kind with =, (coalesce(province, '')) with =, daterange(effective_from, effective_to, '[]') with &&) where (status = 'confirmed' and deleted_at is null);
