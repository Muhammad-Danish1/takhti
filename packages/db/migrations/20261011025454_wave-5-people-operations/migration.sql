CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"leave_year" integer NOT NULL,
	"opening" numeric(5,1) DEFAULT '0' NOT NULL,
	"accrued" numeric(5,1) DEFAULT '0' NOT NULL,
	"used" numeric(5,1) DEFAULT '0' NOT NULL,
	"pending" numeric(5,1) DEFAULT '0' NOT NULL,
	"adjusted" numeric(5,1) DEFAULT '0' NOT NULL,
	"encashed" numeric(5,1) DEFAULT '0' NOT NULL,
	"available" numeric(5,1) GENERATED ALWAYS AS ("leave_balances"."opening" + "leave_balances"."accrued" + "leave_balances"."adjusted" - "leave_balances"."used" - "leave_balances"."pending" - "leave_balances"."encashed") STORED
);
--> statement-breakpoint
ALTER TABLE "leave_balances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leave_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"staff_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"leave_year" integer NOT NULL,
	"kind" text NOT NULL,
	"days" numeric(5,1) NOT NULL,
	"leave_request_id" uuid,
	"note" text,
	CONSTRAINT "leave_ledger_kind_chk" CHECK ("kind" in ('opening', 'accrual', 'taken', 'cancelled', 'carry_forward', 'lapsed', 'encashed', 'adjustment', 'compensatory_earned'))
);
--> statement-breakpoint
ALTER TABLE "leave_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leave_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"employment_types" text[] NOT NULL,
	"staff_type" text DEFAULT 'all' NOT NULL,
	"entitlements" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "leave_policies_staff_type_chk" CHECK ("staff_type" in ('teaching', 'non_teaching', 'all'))
);
--> statement-breakpoint
ALTER TABLE "leave_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leave_requests" (
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
	"leave_type_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"half_day" text DEFAULT 'none' NOT NULL,
	"days" numeric(5,1) NOT NULL,
	"unpaid_days" numeric(5,1) DEFAULT '0' NOT NULL,
	"reason" text NOT NULL,
	"file_id" uuid,
	"contact_phone" text,
	"handover_note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"decided_at" timestamp with time zone,
	"applied_by" uuid NOT NULL,
	CONSTRAINT "leave_requests_half_day_chk" CHECK ("half_day" in ('none', 'first_half', 'second_half')),
	CONSTRAINT "leave_requests_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "leave_requests_to_date_from" CHECK ("to_date" >= "from_date")
);
--> statement-breakpoint
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leave_types" (
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
	"is_paid" boolean DEFAULT true NOT NULL,
	"accrual" text DEFAULT 'yearly' NOT NULL,
	"carry_forward_max" numeric(5,1) DEFAULT '0' NOT NULL,
	"is_encashable" boolean DEFAULT false NOT NULL,
	"max_days_at_once" numeric(5,1),
	"document_after_days" integer,
	"notice_days" integer DEFAULT 0 NOT NULL,
	"gender" text DEFAULT 'all' NOT NULL,
	"min_service_months" integer DEFAULT 0 NOT NULL,
	"counts_non_working_days" boolean DEFAULT false NOT NULL,
	"half_day_allowed" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "leave_types_kind_chk" CHECK ("kind" in ('casual', 'sick', 'annual', 'maternity', 'paternity', 'hajj', 'iddat', 'compensatory', 'study', 'unpaid', 'other')),
	CONSTRAINT "leave_types_accrual_chk" CHECK ("accrual" in ('yearly', 'monthly', 'none')),
	CONSTRAINT "leave_types_gender_chk" CHECK ("gender" in ('all', 'female', 'male'))
);
--> statement-breakpoint
ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_attendance" (
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
	"att_date" date NOT NULL,
	"status" text NOT NULL,
	"check_in" timestamp with time zone,
	"check_out" timestamp with time zone,
	"minutes_late" integer DEFAULT 0 NOT NULL,
	"minutes_early" integer DEFAULT 0 NOT NULL,
	"worked_minutes" integer,
	"source" text NOT NULL,
	"leave_request_id" uuid,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"note" text,
	"is_locked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "staff_attendance_status_chk" CHECK ("status" in ('present', 'absent', 'late', 'half_day', 'leave', 'on_duty', 'holiday', 'weekly_off')),
	CONSTRAINT "staff_attendance_source_chk" CHECK ("source" in ('biometric', 'manual', 'mobile', 'import', 'leave', 'system')),
	CONSTRAINT "staff_attendance_check_out_after" CHECK ("check_out" > "check_in")
);
--> statement-breakpoint
ALTER TABLE "staff_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_attendance_corrections" (
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
	"att_date" date NOT NULL,
	"requested_status" text NOT NULL,
	"requested_check_in" timestamp with time zone,
	"requested_check_out" timestamp with time zone,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	"requested_by" uuid NOT NULL,
	CONSTRAINT "staff_attendance_corrections_status_chk" CHECK ("status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "staff_attendance_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "work_schedules" (
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
	"days" jsonb NOT NULL,
	"late_grace_minutes" integer DEFAULT 10 NOT NULL,
	"half_day_after_minutes" integer DEFAULT 120 NOT NULL,
	"early_leave_grace_minutes" integer DEFAULT 10 NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bank_transfer_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"layout" text NOT NULL,
	"file_id" uuid NOT NULL,
	"payslip_count" integer NOT NULL,
	"total" bigint NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"generated_by" uuid NOT NULL,
	CONSTRAINT "bank_transfer_files_status_chk" CHECK ("status" in ('generated', 'sent', 'confirmed', 'replaced')),
	CONSTRAINT "bank_transfer_files_total_min" CHECK ("total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "final_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"exit_id" uuid NOT NULL,
	"last_working_day" date NOT NULL,
	"lines" jsonb NOT NULL,
	"payable" bigint NOT NULL,
	"recoverable" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	"payslip_id" uuid,
	"document_id" uuid,
	CONSTRAINT "final_settlements_status_chk" CHECK ("status" in ('draft', 'pending', 'approved', 'paid', 'cancelled')),
	CONSTRAINT "final_settlements_payable_min" CHECK ("payable" >= 0),
	CONSTRAINT "final_settlements_recoverable_min" CHECK ("recoverable" >= 0)
);
--> statement-breakpoint
ALTER TABLE "final_settlements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "increments" (
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
	"effective_from" date NOT NULL,
	"old_gross" bigint NOT NULL,
	"new_gross" bigint NOT NULL,
	"percent" numeric(6,2) GENERATED ALWAYS AS (case when "increments"."old_gross" > 0 then round(("increments"."new_gross" - "increments"."old_gross") * 100.0 / "increments"."old_gross", 2) end) STORED,
	"batch_ref" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"approval_request_id" uuid,
	"note" text,
	CONSTRAINT "increments_kind_chk" CHECK ("kind" in ('annual', 'promotion', 'special', 'market_adjustment')),
	CONSTRAINT "increments_status_chk" CHECK ("status" in ('proposed', 'approved', 'applied', 'rejected')),
	CONSTRAINT "increments_effective_from_first" CHECK (extract(day from "effective_from") = 1),
	CONSTRAINT "increments_old_gross_min" CHECK ("old_gross" >= 0),
	CONSTRAINT "increments_new_gross_pos" CHECK ("new_gross" > 0)
);
--> statement-breakpoint
ALTER TABLE "increments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "loan_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"loan_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"due_month" date NOT NULL,
	"amount" bigint NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"payslip_id" uuid,
	CONSTRAINT "loan_installments_status_chk" CHECK ("status" in ('due', 'deducted', 'deferred', 'paid_directly', 'waived')),
	CONSTRAINT "loan_installments_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "loan_installments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"pay_month" date NOT NULL,
	"component_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"reason" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_request_id" uuid,
	CONSTRAINT "payroll_adjustments_kind_chk" CHECK ("kind" in ('earning', 'deduction')),
	CONSTRAINT "payroll_adjustments_source_chk" CHECK ("source" in ('manual', 'attendance_correction', 'substitution', 'exam_duty', 'leave_encashment', 'settlement')),
	CONSTRAINT "payroll_adjustments_status_chk" CHECK ("status" in ('pending', 'approved', 'applied', 'cancelled')),
	CONSTRAINT "payroll_adjustments_amount_pos" CHECK ("amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"run_no" text NOT NULL,
	"kind" text DEFAULT 'regular' NOT NULL,
	"pay_month" date NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"pay_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"staff_count" integer DEFAULT 0 NOT NULL,
	"gross_total" bigint DEFAULT 0 NOT NULL,
	"deductions_total" bigint DEFAULT 0 NOT NULL,
	"net_total" bigint DEFAULT 0 NOT NULL,
	"employer_cost_total" bigint DEFAULT 0 NOT NULL,
	"warnings" jsonb DEFAULT '[]' NOT NULL,
	"calculated_at" timestamp with time zone,
	"approval_request_id" uuid,
	"approved_at" timestamp with time zone,
	CONSTRAINT "payroll_runs_kind_chk" CHECK ("kind" in ('regular', 'off_cycle', 'final_settlement')),
	CONSTRAINT "payroll_runs_status_chk" CHECK ("status" in ('draft', 'calculating', 'calculated', 'under_review', 'approved', 'paid', 'closed', 'cancelled')),
	CONSTRAINT "payroll_runs_pay_month_first" CHECK (extract(day from "pay_month") = 1),
	CONSTRAINT "payroll_runs_gross_total_min" CHECK ("gross_total" >= 0),
	CONSTRAINT "payroll_runs_deductions_total_min" CHECK ("deductions_total" >= 0),
	CONSTRAINT "payroll_runs_net_total_min" CHECK ("net_total" >= 0),
	CONSTRAINT "payroll_runs_employer_cost_total_min" CHECK ("employer_cost_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payslip_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"payslip_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"amount" bigint NOT NULL,
	"basis" jsonb DEFAULT '{}' NOT NULL,
	"loan_installment_id" uuid,
	"adjustment_id" uuid,
	CONSTRAINT "payslip_lines_kind_chk" CHECK ("kind" in ('earning', 'deduction', 'employer_contribution')),
	CONSTRAINT "payslip_lines_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payslip_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"pay_month" date NOT NULL,
	"structure_id" uuid,
	"days_in_period" numeric(5,1) NOT NULL,
	"paid_days" numeric(5,1) NOT NULL,
	"absent_days" numeric(5,1) DEFAULT '0' NOT NULL,
	"unpaid_leave_days" numeric(5,1) DEFAULT '0' NOT NULL,
	"late_half_days" numeric(5,1) DEFAULT '0' NOT NULL,
	"earnings" bigint NOT NULL,
	"deductions" bigint NOT NULL,
	"net" bigint NOT NULL,
	"employer_contributions" bigint DEFAULT 0 NOT NULL,
	"taxable_this_month" bigint DEFAULT 0 NOT NULL,
	"taxable_to_date" bigint DEFAULT 0 NOT NULL,
	"tax_to_date" bigint DEFAULT 0 NOT NULL,
	"pay_method" text NOT NULL,
	"bank_title" text,
	"bank_iban" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"hold_reason" text,
	"paid_on" date,
	"payment_reference" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"document_id" uuid,
	CONSTRAINT "payslips_pay_method_chk" CHECK ("pay_method" in ('bank', 'cash', 'cheque')),
	CONSTRAINT "payslips_status_chk" CHECK ("status" in ('draft', 'approved', 'held', 'paid', 'reversed')),
	CONSTRAINT "payslips_earnings_min" CHECK ("earnings" >= 0),
	CONSTRAINT "payslips_deductions_min" CHECK ("deductions" >= 0),
	CONSTRAINT "payslips_net_min" CHECK ("net" >= 0),
	CONSTRAINT "payslips_employer_contributions_min" CHECK ("employer_contributions" >= 0),
	CONSTRAINT "payslips_taxable_this_month_min" CHECK ("taxable_this_month" >= 0),
	CONSTRAINT "payslips_taxable_to_date_min" CHECK ("taxable_to_date" >= 0),
	CONSTRAINT "payslips_tax_to_date_min" CHECK ("tax_to_date" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "provident_fund_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"staff_id" uuid NOT NULL,
	"pay_month" date NOT NULL,
	"kind" text NOT NULL,
	"employee_amount" bigint DEFAULT 0 NOT NULL,
	"employer_amount" bigint DEFAULT 0 NOT NULL,
	"payslip_id" uuid,
	"note" text,
	CONSTRAINT "provident_fund_entries_kind_chk" CHECK ("kind" in ('contribution', 'withdrawal', 'profit', 'settlement')),
	CONSTRAINT "provident_fund_entries_employee_amount_min" CHECK ("employee_amount" >= 0),
	CONSTRAINT "provident_fund_entries_employer_amount_min" CHECK ("employer_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "provident_fund_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "salary_components" (
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
	"calc" text NOT NULL,
	"system_key" text,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"in_gross" boolean DEFAULT true NOT NULL,
	"prorate" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"expense_account_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "salary_components_kind_chk" CHECK ("kind" in ('earning', 'deduction', 'employer_contribution')),
	CONSTRAINT "salary_components_calc_chk" CHECK ("calc" in ('fixed', 'percent_of_basic', 'system')),
	CONSTRAINT "salary_components_system_key_chk" CHECK ("system_key" in ('income_tax', 'eobi_employee', 'eobi_employer', 'social_security_employer', 'pf_employee', 'pf_employer', 'loan', 'advance', 'absence', 'late', 'leave_encashment', 'arrears')),
	CONSTRAINT "salary_components_system_key_needed" CHECK ("calc" <> 'system' or "system_key" is not null)
);
--> statement-breakpoint
ALTER TABLE "salary_components" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "salary_structure_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"structure_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"amount" bigint,
	"percent" numeric(6,3),
	CONSTRAINT "salary_structure_items_amount_min" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "salary_structure_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "salary_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"basic" bigint NOT NULL,
	"gross" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approval_request_id" uuid,
	"increment_id" uuid,
	CONSTRAINT "salary_structures_reason_chk" CHECK ("reason" in ('joining', 'increment', 'promotion', 'correction', 'restructure')),
	CONSTRAINT "salary_structures_status_chk" CHECK ("status" in ('draft', 'pending', 'active', 'superseded')),
	CONSTRAINT "salary_structures_effective_from_first" CHECK (extract(day from "effective_from") = 1),
	CONSTRAINT "salary_structures_basic_pos" CHECK ("basic" > 0),
	CONSTRAINT "salary_structures_gross_min" CHECK ("gross" >= 0)
);
--> statement-breakpoint
ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"loan_no" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"principal" bigint NOT NULL,
	"reason" text NOT NULL,
	"instalment_count" integer NOT NULL,
	"first_deduction_month" date NOT NULL,
	"outstanding" bigint NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"approval_request_id" uuid,
	"disbursed_on" date,
	"disbursed_from" text,
	"bank_account_id" uuid,
	"requested_by" uuid NOT NULL,
	CONSTRAINT "staff_loans_kind_chk" CHECK ("kind" in ('loan', 'advance')),
	CONSTRAINT "staff_loans_status_chk" CHECK ("status" in ('requested', 'approved', 'disbursed', 'repaying', 'settled', 'rejected', 'cancelled')),
	CONSTRAINT "staff_loans_disbursed_from_chk" CHECK ("disbursed_from" in ('cash', 'bank')),
	CONSTRAINT "staff_loans_principal_pos" CHECK ("principal" > 0),
	CONSTRAINT "staff_loans_outstanding_min" CHECK ("outstanding" >= 0)
);
--> statement-breakpoint
ALTER TABLE "staff_loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appraisal_cycles" (
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
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"self_due_on" date NOT NULL,
	"manager_due_on" date NOT NULL,
	"branch_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "appraisal_cycles_kind_chk" CHECK ("kind" in ('annual', 'mid_year', 'probation')),
	CONSTRAINT "appraisal_cycles_status_chk" CHECK ("status" in ('draft', 'open', 'calibration', 'closed')),
	CONSTRAINT "appraisal_cycles_period_to_after" CHECK ("period_to" > "period_from"),
	CONSTRAINT "appraisal_cycles_manager_due_on_from" CHECK ("manager_due_on" >= "self_due_on")
);
--> statement-breakpoint
ALTER TABLE "appraisal_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appraisal_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"cycle_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"appraiser_staff_id" uuid NOT NULL,
	"reviewer_staff_id" uuid,
	"status" text DEFAULT 'self_pending' NOT NULL,
	"self_submitted_at" timestamp with time zone,
	"manager_submitted_at" timestamp with time zone,
	"final_percent" numeric(5,2),
	"rating_label" text,
	"strengths" text,
	"improvements" text,
	"manager_comment" text,
	"staff_comment" text,
	"recommendation" text DEFAULT 'none' NOT NULL,
	"shared_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	CONSTRAINT "appraisal_forms_status_chk" CHECK ("status" in ('self_pending', 'manager_pending', 'review_pending', 'shared', 'acknowledged', 'closed')),
	CONSTRAINT "appraisal_forms_recommendation_chk" CHECK ("recommendation" in ('none', 'increment', 'promotion', 'confirmation', 'extend_probation', 'improvement_plan'))
);
--> statement-breakpoint
ALTER TABLE "appraisal_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appraisal_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"form_id" uuid NOT NULL,
	"criterion_key" text NOT NULL,
	"self_score" integer,
	"manager_score" integer,
	"final_score" integer,
	"comment" text
);
--> statement-breakpoint
ALTER TABLE "appraisal_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "appraisal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"staff_type" text NOT NULL,
	"scale_max" integer DEFAULT 5 NOT NULL,
	"scale_labels" jsonb NOT NULL,
	"sections" jsonb NOT NULL,
	"rating_bands" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "appraisal_templates_staff_type_chk" CHECK ("staff_type" in ('teaching', 'non_teaching', 'leadership')),
	CONSTRAINT "appraisal_templates_scale_max_range" CHECK ("scale_max" between 3 and 10)
);
--> statement-breakpoint
ALTER TABLE "appraisal_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "classroom_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"branch_id" uuid NOT NULL,
	"teacher_staff_id" uuid NOT NULL,
	"observer_staff_id" uuid NOT NULL,
	"rubric_id" uuid NOT NULL,
	"section_subject_id" uuid,
	"observed_on" date NOT NULL,
	"lesson_no" integer,
	"topic" text,
	"kind" text DEFAULT 'announced' NOT NULL,
	"scores" jsonb DEFAULT '{}' NOT NULL,
	"overall_percent" numeric(5,2),
	"strengths" text,
	"areas_to_improve" text,
	"agreed_actions" text,
	"follow_up_on" date,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"teacher_comment" text,
	CONSTRAINT "classroom_observations_kind_chk" CHECK ("kind" in ('announced', 'unannounced', 'peer', 'walkthrough')),
	CONSTRAINT "classroom_observations_status_chk" CHECK ("status" in ('scheduled', 'done', 'shared', 'acknowledged', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "classroom_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "observation_rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"scale_max" integer DEFAULT 4 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "observation_rubrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"staff_id" uuid NOT NULL,
	"cycle_id" uuid,
	"title" text NOT NULL,
	"measure" text,
	"due_on" date,
	"weight" integer DEFAULT 0 NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"last_update" text,
	CONSTRAINT "staff_goals_status_chk" CHECK ("status" in ('proposed', 'agreed', 'achieved', 'partly_achieved', 'missed', 'dropped')),
	CONSTRAINT "staff_goals_progress_percent_range" CHECK ("progress_percent" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "staff_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"org_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"program_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"status" text DEFAULT 'nominated' NOT NULL,
	"hours_credited" numeric(5,1),
	"score" numeric(5,2),
	"certificate_file_id" uuid,
	"feedback_rating" integer,
	"feedback" text,
	CONSTRAINT "training_attendance_status_chk" CHECK ("status" in ('nominated', 'registered', 'attended', 'completed', 'absent', 'withdrawn')),
	CONSTRAINT "training_attendance_feedback_rating_range" CHECK ("feedback_rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "training_attendance" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "training_programs" (
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
	"provider" text,
	"trainer" text,
	"branch_id" uuid,
	"venue" text,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"hours" numeric(5,1),
	"capacity" integer,
	"cost" bigint DEFAULT 0 NOT NULL,
	"is_mandatory" boolean DEFAULT false NOT NULL,
	"audience" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	CONSTRAINT "training_programs_kind_chk" CHECK ("kind" in ('workshop', 'course', 'orientation', 'certification', 'online', 'conference')),
	CONSTRAINT "training_programs_status_chk" CHECK ("status" in ('planned', 'open', 'completed', 'cancelled')),
	CONSTRAINT "training_programs_ends_on_from" CHECK ("ends_on" >= "starts_on"),
	CONSTRAINT "training_programs_cost_min" CHECK ("cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "training_programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "substitutions_leave_request_id_fk_idx" ON "substitutions" ("leave_request_id") WHERE "leave_request_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_work_schedule_id_fk_idx" ON "staff" ("work_schedule_id") WHERE "work_schedule_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "leave_balances_staff_leave_type_leave_year_uq" ON "leave_balances" ("staff_id","leave_type_id","leave_year") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "leave_balances_leave_type_id_fk_idx" ON "leave_balances" ("leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_ledger_staff_id_fk_idx" ON "leave_ledger" ("staff_id");--> statement-breakpoint
CREATE INDEX "leave_ledger_leave_type_id_fk_idx" ON "leave_ledger" ("leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_ledger_leave_request_id_fk_idx" ON "leave_ledger" ("leave_request_id") WHERE "leave_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "leave_policies_name_uq" ON "leave_policies" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "leave_requests_staff_from_date_idx" ON "leave_requests" ("org_id","staff_id","from_date");--> statement-breakpoint
CREATE INDEX "leave_requests_branch_status_idx" ON "leave_requests" ("org_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "leave_requests_branch_id_fk_idx" ON "leave_requests" ("branch_id");--> statement-breakpoint
CREATE INDEX "leave_requests_staff_id_fk_idx" ON "leave_requests" ("staff_id");--> statement-breakpoint
CREATE INDEX "leave_requests_leave_type_id_fk_idx" ON "leave_requests" ("leave_type_id");--> statement-breakpoint
CREATE INDEX "leave_requests_file_id_fk_idx" ON "leave_requests" ("file_id") WHERE "file_id" is not null;--> statement-breakpoint
CREATE INDEX "leave_requests_approval_request_id_fk_idx" ON "leave_requests" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "leave_requests_applied_by_fk_idx" ON "leave_requests" ("applied_by");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_name_uq" ON "leave_types" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_attendance_staff_att_date_uq" ON "staff_attendance" ("staff_id","att_date") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_attendance_branch_att_date_status_idx" ON "staff_attendance" ("org_id","branch_id","att_date","status");--> statement-breakpoint
CREATE INDEX "staff_attendance_branch_id_fk_idx" ON "staff_attendance" ("branch_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_leave_request_id_fk_idx" ON "staff_attendance" ("leave_request_id") WHERE "leave_request_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_attendance_corrections_branch_id_fk_idx" ON "staff_attendance_corrections" ("branch_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_corrections_staff_id_fk_idx" ON "staff_attendance_corrections" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_attendance_corrections_approval_request_id_fk_idx" ON "staff_attendance_corrections" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_attendance_corrections_requested_by_fk_idx" ON "staff_attendance_corrections" ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "work_schedules_name_uq" ON "work_schedules" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_schedules_default_uq" ON "work_schedules" ("org_id",coalesce("branch_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "is_default" and "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "work_schedules_branch_id_fk_idx" ON "work_schedules" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
CREATE INDEX "bank_transfer_files_branch_id_fk_idx" ON "bank_transfer_files" ("branch_id");--> statement-breakpoint
CREATE INDEX "bank_transfer_files_run_id_fk_idx" ON "bank_transfer_files" ("run_id");--> statement-breakpoint
CREATE INDEX "bank_transfer_files_bank_account_id_fk_idx" ON "bank_transfer_files" ("bank_account_id");--> statement-breakpoint
CREATE INDEX "bank_transfer_files_file_id_fk_idx" ON "bank_transfer_files" ("file_id");--> statement-breakpoint
CREATE INDEX "bank_transfer_files_generated_by_fk_idx" ON "bank_transfer_files" ("generated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "final_settlements_exit_uq" ON "final_settlements" ("exit_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "final_settlements_staff_id_fk_idx" ON "final_settlements" ("staff_id");--> statement-breakpoint
CREATE INDEX "final_settlements_approval_request_id_fk_idx" ON "final_settlements" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "final_settlements_payslip_id_fk_idx" ON "final_settlements" ("payslip_id") WHERE "payslip_id" is not null;--> statement-breakpoint
CREATE INDEX "final_settlements_document_id_fk_idx" ON "final_settlements" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "increments_staff_id_fk_idx" ON "increments" ("staff_id");--> statement-breakpoint
CREATE INDEX "increments_approval_request_id_fk_idx" ON "increments" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "loan_installments_loan_due_month_uq" ON "loan_installments" ("loan_id","due_month") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "loan_installments_staff_id_fk_idx" ON "loan_installments" ("staff_id");--> statement-breakpoint
CREATE INDEX "loan_installments_payslip_id_fk_idx" ON "loan_installments" ("payslip_id") WHERE "payslip_id" is not null;--> statement-breakpoint
CREATE INDEX "payroll_adjustments_staff_id_fk_idx" ON "payroll_adjustments" ("staff_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_component_id_fk_idx" ON "payroll_adjustments" ("component_id");--> statement-breakpoint
CREATE INDEX "payroll_adjustments_approval_request_id_fk_idx" ON "payroll_adjustments" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_branch_pay_month_uq" ON "payroll_runs" ("branch_id","pay_month") WHERE "deleted_at" is null and "kind" = 'regular' and "status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "payroll_runs_approval_request_id_fk_idx" ON "payroll_runs" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "payslip_lines_branch_id_fk_idx" ON "payslip_lines" ("branch_id");--> statement-breakpoint
CREATE INDEX "payslip_lines_payslip_id_fk_idx" ON "payslip_lines" ("payslip_id");--> statement-breakpoint
CREATE INDEX "payslip_lines_staff_id_fk_idx" ON "payslip_lines" ("staff_id");--> statement-breakpoint
CREATE INDEX "payslip_lines_component_id_fk_idx" ON "payslip_lines" ("component_id");--> statement-breakpoint
CREATE INDEX "payslip_lines_loan_installment_id_fk_idx" ON "payslip_lines" ("loan_installment_id") WHERE "loan_installment_id" is not null;--> statement-breakpoint
CREATE INDEX "payslip_lines_adjustment_id_fk_idx" ON "payslip_lines" ("adjustment_id") WHERE "adjustment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payslips_run_staff_uq" ON "payslips" ("run_id","staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "payslips_staff_pay_month_idx" ON "payslips" ("org_id","staff_id","pay_month");--> statement-breakpoint
CREATE INDEX "payslips_branch_id_fk_idx" ON "payslips" ("branch_id");--> statement-breakpoint
CREATE INDEX "payslips_staff_id_fk_idx" ON "payslips" ("staff_id");--> statement-breakpoint
CREATE INDEX "payslips_structure_id_fk_idx" ON "payslips" ("structure_id") WHERE "structure_id" is not null;--> statement-breakpoint
CREATE INDEX "payslips_document_id_fk_idx" ON "payslips" ("document_id") WHERE "document_id" is not null;--> statement-breakpoint
CREATE INDEX "provident_fund_entries_staff_id_fk_idx" ON "provident_fund_entries" ("staff_id");--> statement-breakpoint
CREATE INDEX "provident_fund_entries_payslip_id_fk_idx" ON "provident_fund_entries" ("payslip_id") WHERE "payslip_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_components_name_uq" ON "salary_components" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_components_code_uq" ON "salary_components" ("org_id","code") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "salary_components_expense_account_id_fk_idx" ON "salary_components" ("expense_account_id") WHERE "expense_account_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_structure_items_structure_component_uq" ON "salary_structure_items" ("structure_id","component_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "salary_structure_items_staff_id_fk_idx" ON "salary_structure_items" ("staff_id");--> statement-breakpoint
CREATE INDEX "salary_structure_items_component_id_fk_idx" ON "salary_structure_items" ("component_id");--> statement-breakpoint
CREATE INDEX "salary_structures_staff_id_fk_idx" ON "salary_structures" ("staff_id");--> statement-breakpoint
CREATE INDEX "salary_structures_approval_request_id_fk_idx" ON "salary_structures" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "salary_structures_increment_id_fk_idx" ON "salary_structures" ("increment_id") WHERE "increment_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_loans_staff_id_fk_idx" ON "staff_loans" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_loans_approval_request_id_fk_idx" ON "staff_loans" ("approval_request_id") WHERE "approval_request_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_loans_bank_account_id_fk_idx" ON "staff_loans" ("bank_account_id") WHERE "bank_account_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_loans_requested_by_fk_idx" ON "staff_loans" ("requested_by");--> statement-breakpoint
CREATE UNIQUE INDEX "appraisal_forms_cycle_staff_uq" ON "appraisal_forms" ("cycle_id","staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "appraisal_forms_staff_id_fk_idx" ON "appraisal_forms" ("staff_id");--> statement-breakpoint
CREATE INDEX "appraisal_forms_template_id_fk_idx" ON "appraisal_forms" ("template_id");--> statement-breakpoint
CREATE INDEX "appraisal_forms_appraiser_staff_id_fk_idx" ON "appraisal_forms" ("appraiser_staff_id");--> statement-breakpoint
CREATE INDEX "appraisal_forms_reviewer_staff_id_fk_idx" ON "appraisal_forms" ("reviewer_staff_id") WHERE "reviewer_staff_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "appraisal_scores_form_criterion_key_uq" ON "appraisal_scores" ("form_id","criterion_key") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "appraisal_templates_name_uq" ON "appraisal_templates" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "classroom_observations_teacher_staff_observed_on_idx" ON "classroom_observations" ("org_id","teacher_staff_id","observed_on");--> statement-breakpoint
CREATE INDEX "classroom_observations_branch_id_fk_idx" ON "classroom_observations" ("branch_id");--> statement-breakpoint
CREATE INDEX "classroom_observations_teacher_staff_id_fk_idx" ON "classroom_observations" ("teacher_staff_id");--> statement-breakpoint
CREATE INDEX "classroom_observations_observer_staff_id_fk_idx" ON "classroom_observations" ("observer_staff_id");--> statement-breakpoint
CREATE INDEX "classroom_observations_rubric_id_fk_idx" ON "classroom_observations" ("rubric_id");--> statement-breakpoint
CREATE INDEX "classroom_observations_section_subject_id_fk_idx" ON "classroom_observations" ("section_subject_id") WHERE "section_subject_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "observation_rubrics_name_uq" ON "observation_rubrics" ("org_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "staff_goals_staff_id_fk_idx" ON "staff_goals" ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_goals_cycle_id_fk_idx" ON "staff_goals" ("cycle_id") WHERE "cycle_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "training_attendance_program_staff_uq" ON "training_attendance" ("program_id","staff_id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "training_attendance_staff_id_fk_idx" ON "training_attendance" ("staff_id");--> statement-breakpoint
CREATE INDEX "training_attendance_certificate_file_id_fk_idx" ON "training_attendance" ("certificate_file_id") WHERE "certificate_file_id" is not null;--> statement-breakpoint
CREATE INDEX "training_programs_branch_id_fk_idx" ON "training_programs" ("branch_id") WHERE "branch_id" is not null;--> statement-breakpoint
ALTER TABLE "substitutions" ADD CONSTRAINT "substitutions_leave_request_id_leave_requests_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_work_schedule_id_work_schedules_id_fkey" FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id");--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_leave_types_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id");--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_leave_type_id_leave_types_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id");--> statement-breakpoint
ALTER TABLE "leave_ledger" ADD CONSTRAINT "leave_ledger_leave_request_id_leave_requests_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id");--> statement-breakpoint
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_applied_by_profiles_id_fkey" FOREIGN KEY ("applied_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_leave_request_id_leave_requests_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_approval_request_id_appro_ec9b3691" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "staff_attendance_corrections" ADD CONSTRAINT "staff_attendance_corrections_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ADD CONSTRAINT "bank_transfer_files_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ADD CONSTRAINT "bank_transfer_files_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ADD CONSTRAINT "bank_transfer_files_run_id_payroll_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id");--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ADD CONSTRAINT "bank_transfer_files_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ADD CONSTRAINT "bank_transfer_files_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "bank_transfer_files" ADD CONSTRAINT "bank_transfer_files_generated_by_profiles_id_fkey" FOREIGN KEY ("generated_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "final_settlements" ADD CONSTRAINT "final_settlements_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "final_settlements" ADD CONSTRAINT "final_settlements_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "final_settlements" ADD CONSTRAINT "final_settlements_exit_id_staff_exits_id_fkey" FOREIGN KEY ("exit_id") REFERENCES "staff_exits"("id");--> statement-breakpoint
ALTER TABLE "final_settlements" ADD CONSTRAINT "final_settlements_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "final_settlements" ADD CONSTRAINT "final_settlements_payslip_id_payslips_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id");--> statement-breakpoint
ALTER TABLE "final_settlements" ADD CONSTRAINT "final_settlements_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "increments" ADD CONSTRAINT "increments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "increments" ADD CONSTRAINT "increments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "increments" ADD CONSTRAINT "increments_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_loan_id_staff_loans_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "staff_loans"("id");--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_payslip_id_payslips_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id");--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_component_id_salary_components_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id");--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_approval_request_id_approval_reque_7c4ad3a0" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_payslips_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_component_id_salary_components_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_loan_installment_id_loan_installments_id_fkey" FOREIGN KEY ("loan_installment_id") REFERENCES "loan_installments"("id");--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_adjustment_id_payroll_adjustments_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "payroll_adjustments"("id");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_payroll_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_structure_id_salary_structures_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("id");--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_document_id_generated_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "generated_documents"("id");--> statement-breakpoint
ALTER TABLE "provident_fund_entries" ADD CONSTRAINT "provident_fund_entries_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "provident_fund_entries" ADD CONSTRAINT "provident_fund_entries_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "provident_fund_entries" ADD CONSTRAINT "provident_fund_entries_payslip_id_payslips_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id");--> statement-breakpoint
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_expense_account_id_accounts_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id");--> statement-breakpoint
ALTER TABLE "salary_structure_items" ADD CONSTRAINT "salary_structure_items_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "salary_structure_items" ADD CONSTRAINT "salary_structure_items_structure_id_salary_structures_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "salary_structures"("id");--> statement-breakpoint
ALTER TABLE "salary_structure_items" ADD CONSTRAINT "salary_structure_items_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "salary_structure_items" ADD CONSTRAINT "salary_structure_items_component_id_salary_components_id_fkey" FOREIGN KEY ("component_id") REFERENCES "salary_components"("id");--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_increment_id_increments_id_fkey" FOREIGN KEY ("increment_id") REFERENCES "increments"("id");--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_approval_request_id_approval_requests_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id");--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_requested_by_profiles_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_cycle_id_appraisal_cycles_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "appraisal_cycles"("id");--> statement-breakpoint
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_template_id_appraisal_templates_id_fkey" FOREIGN KEY ("template_id") REFERENCES "appraisal_templates"("id");--> statement-breakpoint
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_appraiser_staff_id_staff_id_fkey" FOREIGN KEY ("appraiser_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_reviewer_staff_id_staff_id_fkey" FOREIGN KEY ("reviewer_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD CONSTRAINT "appraisal_scores_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "appraisal_scores" ADD CONSTRAINT "appraisal_scores_form_id_appraisal_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "appraisal_forms"("id");--> statement-breakpoint
ALTER TABLE "appraisal_templates" ADD CONSTRAINT "appraisal_templates_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "classroom_observations" ADD CONSTRAINT "classroom_observations_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "classroom_observations" ADD CONSTRAINT "classroom_observations_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "classroom_observations" ADD CONSTRAINT "classroom_observations_teacher_staff_id_staff_id_fkey" FOREIGN KEY ("teacher_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "classroom_observations" ADD CONSTRAINT "classroom_observations_observer_staff_id_staff_id_fkey" FOREIGN KEY ("observer_staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "classroom_observations" ADD CONSTRAINT "classroom_observations_rubric_id_observation_rubrics_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "observation_rubrics"("id");--> statement-breakpoint
ALTER TABLE "classroom_observations" ADD CONSTRAINT "classroom_observations_section_subject_id_section_subj_5810d1e1" FOREIGN KEY ("section_subject_id") REFERENCES "section_subjects"("id");--> statement-breakpoint
ALTER TABLE "observation_rubrics" ADD CONSTRAINT "observation_rubrics_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_goals" ADD CONSTRAINT "staff_goals_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "staff_goals" ADD CONSTRAINT "staff_goals_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "staff_goals" ADD CONSTRAINT "staff_goals_cycle_id_appraisal_cycles_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "appraisal_cycles"("id");--> statement-breakpoint
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_program_id_training_programs_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training_programs"("id");--> statement-breakpoint
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_staff_id_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id");--> statement-breakpoint
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_certificate_file_id_files_id_fkey" FOREIGN KEY ("certificate_file_id") REFERENCES "files"("id");--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_org_id_orgs_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id");--> statement-breakpoint
ALTER TABLE "training_programs" ADD CONSTRAINT "training_programs_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
CREATE POLICY "leave_balances_staff" ON "leave_balances" AS PERMISSIVE FOR ALL TO "authenticated" USING ("leave_balances"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("leave_balances"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "leave_ledger_staff_read" ON "leave_ledger" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("leave_ledger"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "leave_ledger_staff_insert" ON "leave_ledger" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("leave_ledger"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "leave_policies_staff" ON "leave_policies" AS PERMISSIVE FOR ALL TO "authenticated" USING ("leave_policies"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("leave_policies"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "leave_requests_staff" ON "leave_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING ("leave_requests"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("leave_requests"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "leave_requests_branch" ON "leave_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "leave_requests"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "leave_requests"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "leave_types_staff" ON "leave_types" AS PERMISSIVE FOR ALL TO "authenticated" USING ("leave_types"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("leave_types"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_attendance_staff" ON "staff_attendance" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_attendance"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_attendance"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_attendance_branch" ON "staff_attendance" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "staff_attendance"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "staff_attendance"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "staff_attendance_corrections_staff" ON "staff_attendance_corrections" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_attendance_corrections"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_attendance_corrections"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_attendance_corrections_branch" ON "staff_attendance_corrections" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "staff_attendance_corrections"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "staff_attendance_corrections"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "work_schedules_staff" ON "work_schedules" AS PERMISSIVE FOR ALL TO "authenticated" USING ("work_schedules"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("work_schedules"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bank_transfer_files_staff" ON "bank_transfer_files" AS PERMISSIVE FOR ALL TO "authenticated" USING ("bank_transfer_files"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("bank_transfer_files"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "bank_transfer_files_branch" ON "bank_transfer_files" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "bank_transfer_files"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "bank_transfer_files"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "bank_transfer_files_cap" ON "bank_transfer_files" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll'))));--> statement-breakpoint
CREATE POLICY "final_settlements_staff" ON "final_settlements" AS PERMISSIVE FOR ALL TO "authenticated" USING ("final_settlements"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("final_settlements"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "final_settlements_cap" ON "final_settlements" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "final_settlements"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "final_settlements"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "increments_staff" ON "increments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("increments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("increments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "increments_cap" ON "increments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "increments"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "increments"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "loan_installments_staff" ON "loan_installments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("loan_installments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("loan_installments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "loan_installments_cap" ON "loan_installments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "loan_installments"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "loan_installments"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "payroll_adjustments_staff" ON "payroll_adjustments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payroll_adjustments"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("payroll_adjustments"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payroll_adjustments_cap" ON "payroll_adjustments" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "payroll_adjustments"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "payroll_adjustments"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "payroll_runs_staff" ON "payroll_runs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payroll_runs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("payroll_runs"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payroll_runs_branch" ON "payroll_runs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "payroll_runs"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "payroll_runs"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "payroll_runs_cap" ON "payroll_runs" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll'))));--> statement-breakpoint
CREATE POLICY "payslip_lines_staff" ON "payslip_lines" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payslip_lines"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("payslip_lines"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payslip_lines_branch" ON "payslip_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "payslip_lines"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "payslip_lines"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "payslip_lines_cap" ON "payslip_lines" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "payslip_lines"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "payslip_lines"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "payslips_staff" ON "payslips" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payslips"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("payslips"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "payslips_branch" ON "payslips" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "payslips"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "payslips"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "payslips_cap" ON "payslips" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "payslips"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "payslips"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "provident_fund_entries_staff_read" ON "provident_fund_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("provident_fund_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "provident_fund_entries_staff_insert" ON "provident_fund_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("provident_fund_entries"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "provident_fund_entries_cap" ON "provident_fund_entries" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "provident_fund_entries"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "provident_fund_entries"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "salary_components_staff" ON "salary_components" AS PERMISSIVE FOR ALL TO "authenticated" USING ("salary_components"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("salary_components"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "salary_structure_items_staff" ON "salary_structure_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("salary_structure_items"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("salary_structure_items"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "salary_structure_items_cap" ON "salary_structure_items" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "salary_structure_items"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "salary_structure_items"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "salary_structures_staff" ON "salary_structures" AS PERMISSIVE FOR ALL TO "authenticated" USING ("salary_structures"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("salary_structures"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "salary_structures_cap" ON "salary_structures" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "salary_structures"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "salary_structures"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "staff_loans_staff" ON "staff_loans" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_loans"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_loans"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_loans_cap" ON "staff_loans" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "staff_loans"."staff_id" = (select app.staff_id()))) WITH CHECK ((not (select app.is_staff()) or (select app.has_cap('payroll')) or "staff_loans"."staff_id" = (select app.staff_id())));--> statement-breakpoint
CREATE POLICY "appraisal_cycles_staff" ON "appraisal_cycles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("appraisal_cycles"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("appraisal_cycles"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "appraisal_forms_staff" ON "appraisal_forms" AS PERMISSIVE FOR ALL TO "authenticated" USING ("appraisal_forms"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("appraisal_forms"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "appraisal_scores_staff" ON "appraisal_scores" AS PERMISSIVE FOR ALL TO "authenticated" USING ("appraisal_scores"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("appraisal_scores"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "appraisal_templates_staff" ON "appraisal_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("appraisal_templates"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("appraisal_templates"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "classroom_observations_staff" ON "classroom_observations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("classroom_observations"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("classroom_observations"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "classroom_observations_branch" ON "classroom_observations" AS RESTRICTIVE FOR ALL TO "authenticated" USING ((not (select app.is_staff()) or (select app.all_branches()) or "classroom_observations"."branch_id" = any ((select app.branch_ids())::uuid[]))) WITH CHECK ((not (select app.is_staff()) or (select app.all_branches()) or "classroom_observations"."branch_id" = any ((select app.branch_ids())::uuid[])));--> statement-breakpoint
CREATE POLICY "observation_rubrics_staff" ON "observation_rubrics" AS PERMISSIVE FOR ALL TO "authenticated" USING ("observation_rubrics"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("observation_rubrics"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "staff_goals_staff" ON "staff_goals" AS PERMISSIVE FOR ALL TO "authenticated" USING ("staff_goals"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("staff_goals"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "training_attendance_staff" ON "training_attendance" AS PERMISSIVE FOR ALL TO "authenticated" USING ("training_attendance"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("training_attendance"."org_id" = (select app.org_id()) and (select app.is_staff()));--> statement-breakpoint
CREATE POLICY "training_programs_staff" ON "training_programs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("training_programs"."org_id" = (select app.org_id()) and (select app.is_staff())) WITH CHECK ("training_programs"."org_id" = (select app.org_id()) and (select app.is_staff()));

-- Hand-written SQL for Wave 5 (packages/db/src/custom-sql/wave-5.sql)

-- salary_structures
alter table salary_structures add constraint salary_structures_no_overlap exclude using gist (staff_id with =, daterange(effective_from, effective_to, '[]') with &&) where (status = 'active' and deleted_at is null);
