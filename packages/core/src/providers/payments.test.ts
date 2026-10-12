import { describe, expect, it } from 'vitest';
import { fakePaymentProvider } from './payments';

/*
 * The stand-in gateway: it must behave like a real one in every way a service can observe, so that
 * what is built against it (docs/plan/10-modules/m22-online-payments-reconciliation.md) needs no
 * change when the real gateways arrive.
 */

const checkout = (reference: string, amount = 850_000) => ({
  reference,
  amount,
  description: 'Fees for October',
  returnUrl: 'http://localhost:3000/family/fees/pay/return',
  payer: { name: 'Farhan Ahmed', phone: '+923001234567' },
});

describe('the fake payment provider', () => {
  it('starts a checkout: a reference of its own, a page to send the payer to, and a time limit', async () => {
    const gateway = fakePaymentProvider();
    const started = await gateway.createCheckout(checkout('PI-2610-00001'));
    expect(started).toMatchObject({
      ok: true,
      providerReference: 'fake_PI-2610-00001',
      redirectUrl: 'http://localhost:3000/family/fees/pay/return?fake=fake_PI-2610-00001',
    });
    expect(started.ok && Date.parse(started.expiresAt)).toBeGreaterThan(Date.now());
    expect(await gateway.inquire('fake_PI-2610-00001')).toEqual({
      providerReference: 'fake_PI-2610-00001',
      state: 'pending',
    });
    // A return address that already has a query keeps it.
    const other = await gateway.createCheckout({
      ...checkout('PI-2'),
      returnUrl: 'http://localhost:3000/return?intent=1',
    });
    expect(other.ok && other.redirectUrl).toBe('http://localhost:3000/return?intent=1&fake=fake_PI-2');
  });

  it('refuses a checkout for nothing', async () => {
    expect(await fakePaymentProvider().createCheckout(checkout('PI-0', 0))).toEqual({
      ok: false,
      retryable: false,
      reason: 'The amount must be more than zero',
    });
  });

  it('a payment that is settled as paid reports the amount and the moment; a part payment reports what was paid', async () => {
    const gateway = fakePaymentProvider();
    await gateway.createCheckout(checkout('PI-1'));
    gateway.settle('fake_PI-1', 'paid');
    const paid = await gateway.inquire('fake_PI-1');
    expect(paid).toMatchObject({ state: 'paid', paidAmount: 850_000 });
    expect('paidAt' in paid && paid.paidAt).toBeTruthy();

    await gateway.createCheckout(checkout('PI-2'));
    gateway.settle('fake_PI-2', 'paid', 800_000);
    expect(await gateway.inquire('fake_PI-2')).toMatchObject({ state: 'paid', paidAmount: 800_000 });

    await gateway.createCheckout(checkout('PI-3'));
    gateway.settle('fake_PI-3', 'failed');
    expect(await gateway.inquire('fake_PI-3')).toEqual({
      providerReference: 'fake_PI-3',
      state: 'failed',
    });
  });

  it('a payment it never heard of is "cannot tell", never "failed"', async () => {
    // The worker has its own stand-in: asked about a checkout made in the web app, it must not
    // decide that payment's fate.
    expect(await fakePaymentProvider().inquire('fake_PI-elsewhere')).toEqual({ unavailable: true });
  });

  it('its callback is signed: the body as sent is read, a body that was changed is refused', async () => {
    const gateway = fakePaymentProvider();
    await gateway.createCheckout(checkout('PI-1'));
    gateway.settle('fake_PI-1', 'paid');
    const { rawBody, headers } = gateway.webhookFor('fake_PI-1', 'evt_1');
    expect(gateway.parseWebhook(rawBody, headers)).toMatchObject({
      eventId: 'evt_1',
      reference: 'PI-1',
      status: { providerReference: 'fake_PI-1', state: 'paid', paidAmount: 850_000 },
    });

    const tampered = rawBody.replace('850000', '1');
    expect(tampered).not.toBe(rawBody);
    expect(gateway.parseWebhook(tampered, headers)).toBeNull();
    expect(gateway.parseWebhook(rawBody, new Headers())).toBeNull();
    expect(gateway.parseWebhook(rawBody, new Headers({ 'x-fake-signature': 'not-it' }))).toBeNull();
    // Another instance of the stand-in checks the same signature, as the web app and the worker do.
    expect(fakePaymentProvider().parseWebhook(rawBody, headers)).not.toBeNull();
  });

  it('only a paid payment can be refunded, and only once', async () => {
    const gateway = fakePaymentProvider();
    await gateway.createCheckout(checkout('PI-1'));
    expect(await gateway.refund('fake_PI-1', 850_000)).toEqual({
      ok: false,
      reason: 'Only a paid payment can be refunded',
    });
    gateway.settle('fake_PI-1', 'paid');
    expect(await gateway.refund('fake_PI-1', 850_000)).toEqual({ ok: true });
    expect(await gateway.inquire('fake_PI-1')).toMatchObject({ state: 'refunded' });
    expect((await gateway.refund('fake_PI-1', 850_000)).ok).toBe(false);
  });

  it('settling or asking for the callback of a payment that does not exist is a mistake in the test', () => {
    const gateway = fakePaymentProvider();
    expect(() => gateway.settle('fake_nothing', 'paid')).toThrow(/No fake payment/);
    expect(() => gateway.webhookFor('fake_nothing')).toThrow(/No fake payment/);
  });
});
