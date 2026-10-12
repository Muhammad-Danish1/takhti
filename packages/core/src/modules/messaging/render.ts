/*
 * Turning a template into the text one person receives. No database and no clock:
 * docs/plan/30-reference/notification-catalogue.md ("Wording rules"), M37 rule R-messaging-15.
 *
 * A template names its variables in double braces: `{{studentNames}} was marked absent today`.
 */

const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g;

/** The variables a template uses, each once, in the order they first appear. */
export function variablesIn(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1] as string;
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

export interface Rendered {
  text: string;
  /** Variables the template used that had no value. They were left out of the text. */
  missing: string[];
}

/** Fills a template. A variable with no value becomes nothing and is reported, never left as braces. */
export function renderTemplate(
  template: string,
  variables: Readonly<Record<string, string | undefined>>,
): Rendered {
  const missing: string[] = [];
  const text = template
    .replace(PLACEHOLDER, (_whole, name: string) => {
      const value = variables[name];
      if (value === undefined || value === '') {
        if (!missing.includes(name)) missing.push(name);
        return '';
      }
      return value;
    })
    // What an empty variable leaves behind: doubled spaces, and a space before punctuation.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([,.;:!?،۔])/g, '$1')
    .trim();
  return { text, missing };
}

/** The variables a template uses that its event does not provide. An empty list means it may be saved. */
export function unknownVariables(template: string, allowed: readonly string[]): string[] {
  const known = new Set(allowed);
  return variablesIn(template).filter((name) => !known.has(name));
}

// The basic character set of an SMS. Anything outside it (all of Urdu) switches the whole message
// to the two-byte encoding, which fits far fewer characters in a part.
const GSM_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
);
/** These exist in the basic encoding but take two places each. */
const GSM_EXTENDED = new Set('^{}\\[~]|€');

export interface SmsSize {
  /** `gsm` for plain Latin text, `unicode` when any character needs the two-byte encoding. */
  encoding: 'gsm' | 'unicode';
  /** Places used: characters, with the few extended ones counted twice. */
  length: number;
  /** How many parts the message is sent and charged as. */
  parts: number;
}

/** How long a text message is and how many parts it takes. A text in Urdu fits 70 characters in one part, English 160. */
export function smsSize(text: string): SmsSize {
  const characters = [...text];
  const plain = characters.every((char) => GSM_BASIC.has(char) || GSM_EXTENDED.has(char));
  if (plain) {
    const length = characters.reduce((sum, char) => sum + (GSM_EXTENDED.has(char) ? 2 : 1), 0);
    return { encoding: 'gsm', length, parts: length <= 160 ? 1 : Math.ceil(length / 153) };
  }
  // Counted in UTF-16 units, as the network counts them.
  const { length } = text;
  return { encoding: 'unicode', length, parts: length <= 70 ? 1 : Math.ceil(length / 67) };
}
