import { z } from 'zod';

/* Allowed-value lists of the platform console (M01). The tables build their check constraints from these. */

export const subscriptionStatuses = [
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
] as const;
export const SubscriptionStatus = z.enum(subscriptionStatuses);
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const billingCycles = ['monthly', 'yearly'] as const;
export const BillingCycle = z.enum(billingCycles);
export type BillingCycle = (typeof billingCycles)[number];

export const subscriptionInvoiceStatuses = ['draft', 'issued', 'paid', 'overdue', 'void'] as const;
export const SubscriptionInvoiceStatus = z.enum(subscriptionInvoiceStatuses);
export type SubscriptionInvoiceStatus = (typeof subscriptionInvoiceStatuses)[number];

export const subscriptionPaymentMethods = ['bank_transfer', 'cheque', 'cash', 'online'] as const;
export const SubscriptionPaymentMethod = z.enum(subscriptionPaymentMethods);
export type SubscriptionPaymentMethod = (typeof subscriptionPaymentMethods)[number];

/** Whether an organisation has a module because of its plan, or because Takhti staff overrode the plan. */
export const orgModuleSources = ['plan', 'override'] as const;
export const OrgModuleSource = z.enum(orgModuleSources);
export type OrgModuleSource = (typeof orgModuleSources)[number];

export const platformRoles = ['super_admin', 'support_agent'] as const;
export const PlatformRole = z.enum(platformRoles);
export type PlatformRole = (typeof platformRoles)[number];

export const supportAccessLevels = ['read', 'write'] as const;
export const SupportAccessLevel = z.enum(supportAccessLevels);
export type SupportAccessLevel = (typeof supportAccessLevels)[number];

export const supportSessionStatuses = [
  'requested',
  'active',
  'ended',
  'expired',
  'denied',
] as const;
export const SupportSessionStatus = z.enum(supportSessionStatuses);
export type SupportSessionStatus = (typeof supportSessionStatuses)[number];

export const announcementAudiences = ['everyone', 'owners', 'staff'] as const;
export const AnnouncementAudience = z.enum(announcementAudiences);
export type AnnouncementAudience = (typeof announcementAudiences)[number];

export const announcementSeverities = ['info', 'warning', 'critical'] as const;
export const AnnouncementSeverity = z.enum(announcementSeverities);
export type AnnouncementSeverity = (typeof announcementSeverities)[number];

export const studentBands = ['under_200', '200_500', '500_1000', '1000_3000', 'over_3000'] as const;
export const StudentBand = z.enum(studentBands);
export type StudentBand = (typeof studentBands)[number];

export const demoRequestStatuses = ['new', 'contacted', 'demo_booked', 'won', 'lost'] as const;
export const DemoRequestStatus = z.enum(demoRequestStatuses);
export type DemoRequestStatus = (typeof demoRequestStatuses)[number];
