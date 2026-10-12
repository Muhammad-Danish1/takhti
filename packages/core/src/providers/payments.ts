import { hmacSha256, signatureMatches } from '../kernel/crypto';
import { addSeconds, nowIso } from '../kernel/dates';
import { env } from '../kernel/env';

/*
 * Online payment gateways. One interface; a local stand-in (`fake`) that behaves like a gateway
 * without moving any money. Real gateways arrive in Phase 18 (M22) and plug in here.
 *
 * Amounts are whole paisa everywhere. A provider's own units are converted inside its adapter.
 */

export interface CheckoutRequest {
  /** Our payment intent id. The provider echoes it back in its callback. */
  reference: string;
  amount: number;
  description: string;
  /** Where the payer's browser returns to. */
  returnUrl: string;
  payer: { name: string; phone?: string; email?: string };
}

export type CheckoutResult =
  | { ok: true; providerReference: string; redirectUrl: string; expiresAt: string }
  | { ok: false; retryable: boolean; reason: string };

export type PaymentState = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface PaymentStatus {
  providerReference: string;
  state: PaymentState;
  /** What the provider says was paid, which is checked against what was asked. */
  paidAmount?: number;
  paidAt?: string;
}

export interface WebhookEvent {
  /** The provider's own id for this notification, so the same one is never handled twice. */
  eventId: string;
  reference: string;
  status: PaymentStatus;
}

export interface PaymentProvider {
  name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  /** Asks the provider what happened to a payment. Used when a callback never arrives. */
  inquire(providerReference: string): Promise<PaymentStatus | { unavailable: true }>;
  /** Checks the signature against the raw body, then reads the notification. Null when the signature is wrong. */
  parseWebhook(rawBody: string, headers: Headers): WebhookEvent | null;
  refund(
    providerReference: string,
    amount: number,
  ): Promise<{ ok: true } | { ok: false; reason: string }>;
}

const FAKE_SECRET = 'takhti-fake-gateway';

/**
 * A gateway that lives in memory. A test (or the developer page) decides the fate of a payment
 * with `settle`, then builds the callback the gateway would send with `webhookFor`.
 */
export function fakePaymentProvider() {
  const payments = new Map<string, PaymentStatus & { amount: number; reference: string }>();
  const provider: PaymentProvider = {
    name: 'fake',
    async createCheckout(request) {
      if (request.amount <= 0)
        return { ok: false, retryable: false, reason: 'The amount must be more than zero' };
      const providerReference = `fake_${request.reference}`;
      payments.set(providerReference, {
        providerReference,
        state: 'pending',
        amount: request.amount,
        reference: request.reference,
      });
      return {
        ok: true,
        providerReference,
        redirectUrl: `${request.returnUrl}${request.returnUrl.includes('?') ? '&' : '?'}fake=${providerReference}`,
        expiresAt: addSeconds(nowIso(), 30 * 60),
      };
    },
    async inquire(providerReference) {
      const payment = payments.get(providerReference);
      // A payment this process never heard of is not a failed one. The web app and the worker each
      // have their own stand-in, so the worker's inquiry about a checkout made in the web app must
      // say "cannot tell", never decide the payment's fate.
      if (!payment) return { unavailable: true };
      const { amount: _amount, reference: _reference, ...status } = payment;
      return status;
    },
    parseWebhook(rawBody, headers) {
      const signature = headers.get('x-fake-signature') ?? '';
      if (!signatureMatches(hmacSha256(FAKE_SECRET, rawBody), signature)) return null;
      try {
        return JSON.parse(rawBody) as WebhookEvent;
      } catch {
        return null;
      }
    },
    async refund(providerReference) {
      const payment = payments.get(providerReference);
      if (!payment || payment.state !== 'paid')
        return { ok: false, reason: 'Only a paid payment can be refunded' };
      payment.state = 'refunded';
      return { ok: true };
    },
  };
  return {
    ...provider,
    /** Decides what happened to a payment, as the payer's bank would. */
    settle(
      providerReference: string,
      state: Exclude<PaymentState, 'pending'>,
      paidAmount?: number,
    ): void {
      const payment = payments.get(providerReference);
      if (!payment) throw new Error(`No fake payment "${providerReference}"`);
      payment.state = state;
      if (state === 'paid') {
        payment.paidAmount = paidAmount ?? payment.amount;
        payment.paidAt = nowIso();
      }
    },
    /** The callback the gateway would send for a payment, correctly signed. */
    webhookFor(
      providerReference: string,
      eventId = `evt_${providerReference}`,
    ): { rawBody: string; headers: Headers } {
      const payment = payments.get(providerReference);
      if (!payment) throw new Error(`No fake payment "${providerReference}"`);
      const { amount: _amount, reference, ...status } = payment;
      const rawBody = JSON.stringify({ eventId, reference, status } satisfies WebhookEvent);
      return {
        rawBody,
        headers: new Headers({ 'x-fake-signature': hmacSha256(FAKE_SECRET, rawBody) }),
      };
    },
  };
}

let provider: PaymentProvider | undefined;

/** The payment provider in use, chosen by the environment. */
export function paymentProvider(): PaymentProvider {
  if (provider) return provider;
  // `fake` is the only provider until Phase 18 adds the real gateways to this switch.
  if (env().PAYMENT_PROVIDER === 'fake') provider = fakePaymentProvider();
  else throw new Error(`No payment provider named "${String(env().PAYMENT_PROVIDER)}"`);
  return provider;
}

export function setPaymentProvider(next: PaymentProvider | undefined): void {
  provider = next;
}
