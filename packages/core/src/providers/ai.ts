import { env } from '../kernel/env';
import { sha256 } from '../kernel/crypto';

/*
 * The AI provider. One interface; a local stand-in (`fake`) that replays recorded answers, so tests
 * and local development need no key and cost nothing. The real adapter arrives in Phase 19.
 *
 * Two rules every feature that uses AI follows:
 *   - an answer may be `unavailable` (the provider is down, refused, or the school's budget is
 *     spent), and the feature must work without it;
 *   - the model never writes to the database. It proposes; a person confirms; a service saves.
 */

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRequest {
  /** Which feature is asking, for budgets and for finding the recorded answer. */
  feature: string;
  system: string;
  messages: readonly AiMessage[];
  maxTokens: number;
  /** A JSON schema the answer must fit, when the feature needs structured output. */
  schema?: Record<string, unknown>;
}

export type AiResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number; model: string }
  | {
      ok: false;
      unavailable: true;
      reason: 'not-configured' | 'provider-down' | 'refused' | 'over-budget' | 'no-recording';
    };

export interface AiProvider {
  name: string;
  complete(request: AiRequest): Promise<AiResult>;
}

/** The key a recorded answer is stored under: the feature and a fingerprint of what was asked. */
export const recordingKey = (request: AiRequest): string =>
  `${request.feature}:${sha256(JSON.stringify([request.system, request.messages])).slice(0, 16)}`;

/**
 * Replays recorded answers. With nothing recorded for a request it answers `unavailable`, which
 * exercises exactly the path every feature must handle anyway.
 */
export function fakeAiProvider(recordings: Record<string, string> = {}) {
  const store = new Map(Object.entries(recordings));
  const provider: AiProvider = {
    name: 'fake',
    async complete(request) {
      const text = store.get(recordingKey(request)) ?? store.get(request.feature);
      if (text === undefined) return { ok: false, unavailable: true, reason: 'no-recording' };
      return { ok: true, text, inputTokens: 0, outputTokens: 0, model: 'fake' };
    },
  };
  return {
    ...provider,
    /** Records the answer for a whole feature, or for one exact request. */
    record(featureOrRequest: string | AiRequest, text: string): void {
      store.set(
        typeof featureOrRequest === 'string' ? featureOrRequest : recordingKey(featureOrRequest),
        text,
      );
    },
  };
}

let provider: AiProvider | undefined;

/** The AI provider in use, chosen by the environment. */
export function aiProvider(): AiProvider {
  if (provider) return provider;
  if (env().AI_PROVIDER === 'fake') {
    provider = fakeAiProvider();
  } else {
    // The real adapter is written in Phase 19. Until then a configured key changes nothing: features see "unavailable".
    provider = {
      name: 'unconfigured',
      complete: async () => ({ ok: false, unavailable: true, reason: 'not-configured' }),
    };
  }
  return provider;
}

export function setAiProvider(next: AiProvider | undefined): void {
  provider = next;
}
