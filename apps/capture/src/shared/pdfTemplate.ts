/**
 * Shared DER-brand print templates for client-side PDF exports.
 *
 * Centralises typography, colour, layout + the DER brand mark so
 * every exported document reads as "a DER artefact" — same
 * banner, same identity grid, same per-page footer. Tokens mirror
 * the Capture app's palette (see styles.ts) so a paper copy
 * shows the same hues an operator sees on screen.
 *
 * Page-level footer is NOT in this HTML — pdfExport.ts stamps it
 * with jsPDF.text() on every rendered page so it always sits at
 * the physical page bottom, not inside the content flow.
 */
import { DER_BRAND_MARK_WHITE_SVG } from './derBrandMark';

export interface DerPdfHeader {
  /** Short category label rendered above the title — e.g.
   *  "Patient identity", "Enrolment notes". */
  readonly eyebrow: string;
  /** The subject of the document — usually the operator-facing
   *  name of the person / record. */
  readonly title: string;
  /** Optional secondary line under the title (count, program,
   *  etc.). */
  readonly subtitle?: string;
}

export interface DerPdfIdentityField {
  readonly label: string;
  readonly value: string;
  /** Render as monospace (UIDs, codes). */
  readonly code?: boolean;
}

export interface DerPdfFooter {
  readonly left: string;
  readonly right: string;
}

export const DER_PDF_STYLES = `
  @page { size: A4; margin: 16mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; }
  html, body {
    background: #FAFBFD;
    color: #101a32;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont,
      'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt; line-height: 1.5;
    margin: 0; padding: 0;
  }
  /* Brand banner — slate-blue chrome stripe over a thin accent bar
   * in DER brand blue, matching the running app's top bar. */
  .der-pdf-banner {
    background: #0d2e5c;
    color: #eaf0f7;
    padding: 12px 18px;
    border-top: 4px solid #0d58a8;
  }
  .der-pdf-banner__row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px;
  }
  .der-pdf-banner__lockup {
    display: flex; align-items: center; gap: 12px;
  }
  .der-pdf-banner__mark {
    width: 36px; height: 36px; flex: 0 0 36px;
    display: block;
  }
  .der-pdf-banner__wordmark {
    display: flex; flex-direction: column; line-height: 1.1;
  }
  .der-pdf-banner__wordmark strong {
    font-size: 13pt; font-weight: 700; color: #ffffff;
    letter-spacing: 0.02em;
  }
  .der-pdf-banner__tagline {
    font-size: 9pt; letter-spacing: 0.08em;
    text-transform: uppercase; color: #a7b4c7;
  }
  .der-pdf-banner__stamp {
    font-size: 9pt; color: #a7b4c7;
  }
  .der-pdf-head {
    padding: 18px 18px 14px;
    background: #FAFBFD;
    border-bottom: 1px solid #DCE2EB;
  }
  .der-pdf-head__eyebrow {
    font-size: 9pt; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #0d58a8;
    margin: 0 0 6px 0;
  }
  .der-pdf-head__title {
    font-size: 20pt; font-weight: 700;
    margin: 0; color: #101a32;
    line-height: 1.2;
  }
  .der-pdf-head__sub {
    margin: 6px 0 0; font-size: 10pt; color: #5b6478;
  }
  /* Content wrapper — keep margins off the print edge via @page. */
  .der-pdf-body {
    padding: 18px 18px 24px;
  }
  /* Identity grid — two-column key/value layout. No surrounding
   * frame; the data reads as content, not a card. */
  .der-pdf-identity {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 6px 16px;
    margin: 0 0 20px;
  }
  .der-pdf-identity__label {
    font-size: 9pt; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    color: #5b6478;
    align-self: start;
  }
  .der-pdf-identity__value {
    font-size: 10.5pt; color: #101a32;
    overflow-wrap: anywhere;
  }
  .der-pdf-identity__value code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 9.5pt;
    color: #2a3447;
  }
  /* Section title — small caps, accent-left bar in brand blue. */
  .der-pdf-section-title {
    font-size: 11pt; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: #101a32;
    margin: 22px 0 10px;
    padding: 4px 0 4px 10px;
    border-left: 3px solid #0d58a8;
  }
  /* Status pill — reads on a paper copy. */
  .der-pdf-pill {
    display: inline-block;
    padding: 1px 8px; border-radius: 10px;
    font-size: 9pt; font-weight: 500;
    letter-spacing: 0.02em;
  }
  .der-pdf-pill--active   { background: #E6F2EC; color: #1a6e4c; }
  .der-pdf-pill--completed{ background: #e6f1fb; color: #0f68b7; }
  .der-pdf-pill--cancelled{ background: #F7E0E0; color: #8a2525; }
`;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

export function derPdfBanner(generatedAt: string): string {
  // Inline brand mark on the left + stacked wordmark + tagline;
  // generated-at stamp on the right. The <svg> is injected as-is;
  // the surrounding .der-pdf-banner__mark CSS rule sizes it.
  const markWrapped = DER_BRAND_MARK_WHITE_SVG
    .replace('<svg ', '<svg class="der-pdf-banner__mark" ');
  return `
    <div class="der-pdf-banner">
      <div class="der-pdf-banner__row">
        <div class="der-pdf-banner__lockup">
          ${markWrapped}
          <span class="der-pdf-banner__wordmark">
            <strong>DER</strong>
            <span class="der-pdf-banner__tagline">
              DHIS2 Edge Runtime · Capture
            </span>
          </span>
        </div>
        <span class="der-pdf-banner__stamp">
          Generated ${esc(generatedAt)}
        </span>
      </div>
    </div>`;
}

export function derPdfHead(header: DerPdfHeader): string {
  return `
    <header class="der-pdf-head">
      <p class="der-pdf-head__eyebrow">${esc(header.eyebrow)}</p>
      <h1 class="der-pdf-head__title">${esc(header.title)}</h1>
      ${header.subtitle
        ? `<p class="der-pdf-head__sub">${esc(header.subtitle)}</p>`
        : ''}
    </header>`;
}

export function derPdfIdentity(fields: ReadonlyArray<DerPdfIdentityField>): string {
  if (fields.length === 0) return '';
  const rows = fields.map((f) => `
    <div class="der-pdf-identity__label">${esc(f.label)}</div>
    <div class="der-pdf-identity__value">${f.code
      ? `<code>${esc(f.value)}</code>` : esc(f.value)}</div>`).join('');
  return `<section class="der-pdf-identity">${rows}</section>`;
}

export function derPdfSectionTitle(text: string): string {
  return `<h2 class="der-pdf-section-title">${esc(text)}</h2>`;
}

export function derPdfPill(status: string | null | undefined): string {
  if (!status) return '';
  const s = status.toUpperCase();
  const cls = s === 'COMPLETED' ? 'completed'
    : s === 'CANCELLED' ? 'cancelled' : 'active';
  const label = s.charAt(0) + s.slice(1).toLowerCase();
  return `<span class="der-pdf-pill der-pdf-pill--${cls}">${esc(label)}</span>`;
}

/** Footer text is stamped on every rendered PDF page by
 *  pdfExport.exportHtmlAsPdf — this helper returns the two
 *  left/right strings so callers don't have to know about the
 *  per-page draw step. Nothing is emitted into the HTML. */
export function derPdfFooter(f: DerPdfFooter): {
  left: string; right: string;
} {
  return { left: f.left, right: f.right };
}

export interface DerPdfDocument {
  readonly html: string;
  readonly footer: { readonly left: string; readonly right: string };
}

export function derPdfDocument(
  content: {
    header: DerPdfHeader;
    body: string;
    footer: DerPdfFooter;
    generatedAt: string;
    docTitle: string;
  },
): DerPdfDocument {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(content.docTitle)}</title>
<style>${DER_PDF_STYLES}</style>
</head>
<body>
  ${derPdfBanner(content.generatedAt)}
  ${derPdfHead(content.header)}
  <main class="der-pdf-body">${content.body}</main>
</body>
</html>`;
  return { html, footer: derPdfFooter(content.footer) };
}
