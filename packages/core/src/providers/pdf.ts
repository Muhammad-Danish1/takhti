/*
 * Turning a print page into a PDF. The real renderer (headless Chromium) arrives in Phase 16.
 * Until then `noop` says so, and the caller offers the print view in the browser instead, which
 * shows the same page.
 */

export interface PdfRequest {
  /** The address of the print page, already carrying its short-lived token. */
  url: string;
  /** Paper size. Vouchers and receipts are A5 or a slip; most documents are A4. */
  paper: 'A4' | 'A5' | 'slip';
  landscape?: boolean;
}

export type PdfResult =
  { ok: true; content: Uint8Array } | { ok: false; unavailable: true; reason: string };

export interface PdfRenderer {
  name: string;
  render(request: PdfRequest): Promise<PdfResult>;
}

const noop: PdfRenderer = {
  name: 'noop',
  render: async () => ({
    ok: false,
    unavailable: true,
    reason: 'The PDF renderer is not installed yet',
  }),
};

let renderer: PdfRenderer = noop;

export const pdfRenderer = (): PdfRenderer => renderer;

export function setPdfRenderer(next: PdfRenderer | undefined): void {
  renderer = next ?? noop;
}
