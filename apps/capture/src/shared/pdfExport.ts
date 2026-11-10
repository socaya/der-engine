/**
 * Client-side PDF export helper.
 *
 * Why: the legacy flow opened a new window and called window.print(),
 * which modern popup blockers block without a clear user gesture
 * chain. This helper takes a self-contained HTML document string,
 * renders it off-screen, screenshots it with html2canvas, wraps the
 * result in a jsPDF A4 document, and triggers a direct download —
 * no popup, no print dialog.
 *
 * The off-screen host is a fixed-position iframe styled at the
 * target print width so html2canvas captures real paint output
 * (fonts loaded, images rendered) instead of a cardboard screenshot
 * of the live dashboard. We delete the iframe once the PDF blob is
 * ready so the DOM stays clean.
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfExportOptions {
  /** Full HTML document string — html, head, body, embedded <style>.
   *  The body's visual width should match the printWidthPx param or
   *  the canvas will crop. */
  readonly html: string;
  /** Output file name (without extension). */
  readonly fileName: string;
  /** Pixel width used for the off-screen render. 794px matches
   *  A4 at 96 dpi. */
  readonly printWidthPx?: number;
  /** Optional per-page footer stamped at the bottom of every
   *  rendered page via jsPDF.text(). Keeps the footer at the
   *  physical page bottom instead of inside the content flow —
   *  html2canvas can't render CSS @page footers and position:fixed
   *  leaks into the content screenshot. */
  readonly footer?: {
    readonly left: string;
    readonly right: string;
  };
}

/** Render an HTML document to an A4 PDF and trigger a download.
 *  Returns when the download has been issued; rejects on any
 *  rendering failure (empty html, html2canvas crash, blob write). */
export async function exportHtmlAsPdf(opts: PdfExportOptions): Promise<void> {
  const widthPx = opts.printWidthPx ?? 794;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = widthPx + 'px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) {
      throw new Error('iframe has no document');
    }
    doc.open();
    doc.write(opts.html);
    doc.close();
    // Wait for layout + any @font-face / <img> to settle before we
    // screenshot. Measure the real paint height so multi-page docs
    // don't lose content.
    await new Promise<void>((r) => {
      if (doc.readyState === 'complete') { r(); return; }
      iframe.onload = () => r();
    });
    await new Promise((r) => setTimeout(r, 120));
    const body = doc.body;
    iframe.style.height = body.scrollHeight + 'px';
    const canvas = await html2canvas(body, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: widthPx,
    });
    // A4 at 72 dpi (jsPDF default) is 595pt x 842pt. Fit canvas by
    // width, let height overflow onto additional pages via jsPDF's
    // page split helper.
    const pdf = new jsPDF({ unit: 'pt', format: 'a4',
      orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    // Reserve 36pt at the bottom of every page for the footer
    // overlay so the content image doesn't collide with it.
    const footerHeight = opts.footer ? 28 : 0;
    const contentPtHeight = pageHeight - footerHeight;
    const pxPerPt = canvas.width / pageWidth;
    const pageCanvasHeight = Math.floor(contentPtHeight * pxPerPt);
    let yOffset = 0;
    let pageIndex = 0;
    while (yOffset < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight,
        canvas.height - yOffset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext('2d');
      if (!ctx) {
        throw new Error('slice canvas has no 2d context');
      }
      ctx.drawImage(canvas, 0, -yOffset);
      const dataUrl = slice.toDataURL('image/jpeg', 0.9);
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', 0, 0,
        pageWidth, sliceHeight / pxPerPt);
      yOffset += sliceHeight;
      pageIndex++;
    }
    // Stamp the footer at the physical bottom of every rendered
    // page. jsPDF measures in points at 72dpi; the hairline rule
    // sits 4pt above the baseline so the two text strings stay
    // off the page edge.
    if (opts.footer) {
      const totalPages = pdf.getNumberOfPages();
      const footerY = pageHeight - 14;
      const ruleY = pageHeight - 22;
      const sideMargin = 24;
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        // Hairline rule in the token border colour (#DCE2EB).
        pdf.setDrawColor(220, 226, 235);
        pdf.setLineWidth(0.5);
        pdf.line(sideMargin, ruleY, pageWidth - sideMargin, ruleY);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(34, 67, 108); // --der-chrome-bg
        pdf.text('DER', sideMargin, footerY);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(148, 160, 180); // --der-text-faint-ish
        pdf.text(' · DHIS2 Edge Runtime',
          sideMargin + pdf.getTextWidth('DER'), footerY);
        const rightText = `${opts.footer.left}  ·  ${opts.footer.right}`
          + `   Page ${p} of ${totalPages}`;
        pdf.setFontSize(8);
        pdf.setTextColor(148, 160, 180);
        pdf.text(rightText, pageWidth - sideMargin, footerY,
          { align: 'right' });
      }
    }
    pdf.save(opts.fileName + '.pdf');
  } finally {
    iframe.remove();
  }
}
