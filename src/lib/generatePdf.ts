/**
 * generatePdf.ts
 * Generates a PDF from the off-screen print pages using html2canvas + jsPDF.
 * Each .print-page div is captured as a 2x retina bitmap and added as one PDF page.
 */

export interface PdfOptions {
  format: "A4" | "A5";
  title: string;
  onProgress?: (current: number, total: number) => void;
}

export async function generatePhotoBookPdf(
  containerEl: HTMLElement,
  options: PdfOptions
): Promise<void> {
  const { format, title, onProgress } = options;

  // Dynamically import to avoid SSR issues
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  // A4: 210×297mm, A5: 148×210mm
  const pdfW = format === "A5" ? 148 : 210;
  const pdfH = format === "A5" ? 210 : 297;
  const pxW  = format === "A5" ? 559 : 794;
  const pxH  = format === "A5" ? 794 : 1123;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: format === "A5" ? [148, 210] : [210, 297],
    compress: true,
  });

  const pages = Array.from(containerEl.querySelectorAll<HTMLElement>(".print-page"));

  if (pages.length === 0) {
    console.warn("generatePhotoBookPdf: No .print-page elements found.");
    return;
  }

  // Move the whole container into visible area for capture, then restore
  const originalPosition = containerEl.style.position;
  const originalLeft = containerEl.style.left;
  const originalTop = containerEl.style.top;
  const originalZIndex = containerEl.style.zIndex;
  const originalWidth = containerEl.style.width;
  const originalOpacity = containerEl.style.opacity;

  // Place container off-screen but accessible (not -9999px which blocks rendering)
  containerEl.style.position = "fixed";
  containerEl.style.left = "0px";
  containerEl.style.top = "0px";
  containerEl.style.zIndex = "-100";
  containerEl.style.width = `${pxW}px`;
  containerEl.style.opacity = "1"; // hidden via z-index behind editor overlay

  // Small delay for layout to settle
  await new Promise((r) => setTimeout(r, 150));

  try {
    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];

      onProgress?.(i + 1, pages.length);

      // Scroll the page into view within the fixed container
      pageEl.scrollIntoView({ block: "start" });

      const canvas = await html2canvas(pageEl, {
        scale: 2,              // 2x = high-resolution for print quality
        useCORS: true,         // allow cross-origin images (S3 etc.)
        allowTaint: false,
        backgroundColor: "#fcfaf7",
        logging: false,
        width: pxW,
        height: pxH,
        windowWidth: pxW,
        windowHeight: pxH,
        x: 0,
        y: 0,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.93);

      if (i > 0) {
        pdf.addPage([pdfW, pdfH], "portrait");
      }

      // Fill the entire PDF page with the captured image (no margins)
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH, undefined, "FAST");
    }
  } finally {
    // Always restore the container styles
    containerEl.style.position = originalPosition;
    containerEl.style.left = originalLeft;
    containerEl.style.top = originalTop;
    containerEl.style.zIndex = originalZIndex;
    containerEl.style.width = originalWidth;
    containerEl.style.opacity = originalOpacity;
  }

  // Sanitize filename
  const safeName =
    title.replace(/[^a-zA-Z0-9\u00C0-\u017F\s_-]/g, "").trim() || "fotokniha";
  pdf.save(`fotokniha-${safeName}.pdf`);
}
