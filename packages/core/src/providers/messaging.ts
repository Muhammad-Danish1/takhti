import { nowIso } from '../kernel/dates';
import { env } from '../kernel/env';
import { logger } from '../kernel/logger';

/*
 * Outside channels: SMS, WhatsApp, email and push. Each is an interface with a local stand-in.
 * The stand-in (`log`) sends nothing: it keeps the message in memory and writes one log line, so a
 * developer can see exactly what would have gone out. Real providers arrive in Phase 18 and plug
 * in here without any caller changing.
 *
 * Messages are only ever sent from a background job, never from a request.
 */

export type Channel = 'sms' | 'whatsapp' | 'email' | 'push';

export interface OutgoingMessage {
  /** A phone number (`+923…`), an email address, or a device's push token. */
  to: string;
  /** Email subject or push title. */
  subject?: string;
  body: string;
  /** WhatsApp: the name of the template Meta approved, with its variables. */
  template?: { name: string; variables: Record<string, string> };
  /** Ours, to match the provider's delivery report to the message. */
  reference: string;
}

export type SendResult =
  | { ok: true; providerMessageId: string }
  /** `retryable`: the provider was unreachable or busy. Otherwise the message itself was refused. */
  | { ok: false; retryable: boolean; reason: string };

export interface MessageProvider {
  channel: Channel;
  name: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}

export interface SentMessage extends OutgoingMessage {
  channel: Channel;
  at: string;
}

const outbox: SentMessage[] = [];
const OUTBOX_LIMIT = 500;

/** What the local stand-ins "sent", newest last. Shown on the developer outbox page; read by tests. */
export const localOutbox = (): readonly SentMessage[] => outbox;
export const clearLocalOutbox = (): void => {
  outbox.length = 0;
};

function logProvider(channel: Channel): MessageProvider {
  return {
    channel,
    name: 'log',
    async send(message) {
      outbox.push({ ...message, channel, at: nowIso() });
      if (outbox.length > OUTBOX_LIMIT) outbox.splice(0, outbox.length - OUTBOX_LIMIT);
      // The recipient and the text stay out of the log; the reference finds the message in the outbox.
      logger().info(
        { channel, reference: message.reference },
        'message kept in the local outbox (nothing was sent)',
      );
      return { ok: true, providerMessageId: `local-${message.reference}` };
    },
  };
}

const overrides = new Map<Channel, MessageProvider>();

/** The provider for a channel, chosen by the environment. */
export function messageProvider(channel: Channel): MessageProvider {
  const override = overrides.get(channel);
  if (override) return override;
  const configured = {
    sms: env().SMS_PROVIDER,
    whatsapp: env().WHATSAPP_PROVIDER,
    email: env().EMAIL_PROVIDER,
    push: env().PUSH_PROVIDER,
  }[channel];
  // `log` is the only provider until Phase 18 adds the real ones to this switch.
  if (configured === 'log') return logProvider(channel);
  throw new Error(`No ${channel} provider named "${String(configured)}"`);
}

/** Replaces a channel's provider: a failing one in a test, a real one in production set-up code. */
export function setMessageProvider(channel: Channel, provider: MessageProvider | undefined): void {
  if (provider) overrides.set(channel, provider);
  else overrides.delete(channel);
}
