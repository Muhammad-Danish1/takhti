import { z } from 'zod';
import { LongText, Money, Name, QueryBool } from '../../kernel/primitives';
import { baseEntity, defineResource, listQuery, MAX_PAGE_SIZE } from '../../kernel/resource';
import { EntityType } from './attachments.contract';
import { ApprovalStatus, ApprovalStepStatus } from './shared.constants';

/*
 * Approvals: docs/plan/10-modules/m00-shared-kernel.md, sections 4 and 5.
 * A policy says who must approve a kind of change, and above which amount. A request is one
 * change waiting for those people, step by step.
 */

// ---------------------------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------------------------

/** One step of a policy: anyone holding one of these roles may decide it. */
export const ApprovalPolicyStep = z.object({
  roleKeys: z
    .array(z.string().regex(/^[a-z][a-z0-9_]*$/, 'Not a role'))
    .min(1, { error: 'Choose at least one role' })
    .max(10),
});

const policyFields = {
  /** The kind of record the policy is for: `student-discounts`, `expenses`, `leave-requests`. */
  entityType: EntityType,
  name: Name,
  /** The policy applies at or above this amount. Empty: at any amount. */
  minAmount: Money.nullable(),
  steps: z
    .array(ApprovalPolicyStep)
    .min(1, { error: 'A policy needs at least one step' })
    .max(5, { error: 'A policy can have five steps at most' }),
  isActive: z.boolean(),
};

export const ApprovalPolicy = z.object({ ...baseEntity, ...policyFields });
export type ApprovalPolicy = z.output<typeof ApprovalPolicy>;

export const CreateApprovalPolicy = z.object({
  id: z.uuid().optional(),
  entityType: policyFields.entityType,
  name: policyFields.name,
  minAmount: policyFields.minAmount.optional(),
  steps: policyFields.steps,
  isActive: policyFields.isActive.optional(),
});
export type CreateApprovalPolicy = z.output<typeof CreateApprovalPolicy>;

export const UpdateApprovalPolicy = z
  .object(policyFields)
  .partial()
  .extend({ version: z.int() });
export type UpdateApprovalPolicy = z.output<typeof UpdateApprovalPolicy>;

export const ListApprovalPolicies = listQuery({
  sortable: ['entityType', 'name', 'createdAt'],
  defaultSort: 'entityType',
  filters: { entityType: EntityType.optional(), isActive: QueryBool.optional() },
});
export type ListApprovalPoliciesParams = z.output<typeof ListApprovalPolicies>;

export const approvalPoliciesContract = defineResource({
  name: 'approval-policies',
  path: '/approval-policies',
  entity: ApprovalPolicy,
  create: CreateApprovalPolicy,
  update: UpdateApprovalPolicy,
  list: ListApprovalPolicies,
});

// ---------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------

/**
 * `waiting`: requests whose current step the person may decide. `mine`: requests the person raised.
 * `all`: every request of the school, for those who hold `approvals:read`.
 */
export const approvalScopes = ['waiting', 'mine', 'all'] as const;
export type ApprovalScope = (typeof approvalScopes)[number];

export const ListApprovals = z.strictObject({
  scope: z.enum(approvalScopes).default('waiting'),
  status: ApprovalStatus.optional(),
  entityType: EntityType.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});
export type ListApprovals = z.output<typeof ListApprovals>;

export const ApprovalStepView = z.object({
  stepOrder: z.int(),
  /** The roles that may decide this step. */
  roleKeys: z.array(z.string()),
  status: ApprovalStepStatus,
  decidedBy: z.uuid().nullable(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  note: z.string().nullable(),
});
export type ApprovalStepView = z.output<typeof ApprovalStepView>;

export const ApprovalRequest = z.object({
  id: z.uuid(),
  version: z.int(),
  /** The kind of record waiting, and which one. */
  entityType: z.string(),
  entityId: z.uuid(),
  branchId: z.uuid().nullable(),
  /** One line that says what is being asked. */
  summary: z.string(),
  amount: z.number().nullable(),
  status: ApprovalStatus,
  /** The step that is waiting, counting from 1. */
  currentStep: z.int(),
  stepCount: z.int(),
  requestedBy: z.uuid(),
  requestedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  /** Whether the person asking may decide the step that is waiting. */
  canDecide: z.boolean(),
  /** Every step with who decided it. Present when one request is opened. */
  steps: z.array(ApprovalStepView).optional(),
});
export type ApprovalRequest = z.output<typeof ApprovalRequest>;

/** Body of approve and reject. A rejection must say why. */
export const Decision = z.object({ note: LongText.optional() });
export type Decision = z.output<typeof Decision>;
