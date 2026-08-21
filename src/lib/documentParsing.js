// Client-side document parsing — closes the "PDFs/Office docs etc. are an
// honest gap" note in localTools.js's analyzeAttachmentTool. pdf.js for real
// PDF text extraction, tesseract.js for OCR (scanned docs/whiteboard photos)
// and handwriting recognition. Both run entirely in the browser — no cloud
// API, no new credential, consistent with Vaea's local-first model (same
// reasoning the Google Workspace/vault features already follow).
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const MAX_PDF_PAGES = 30;

export async function extractPdfText(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return { text: pages.join("\n\n"), pageCount: doc.numPages, truncated: doc.numPages > MAX_PDF_PAGES };
}

// Lazily imported — tesseract.js pulls in a real OCR engine (wasm + trained
// data, fetched on first use), no reason to add that to every page's bundle
// just because attachment analysis exists somewhere in the app.
export async function ocrImage(blob) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(blob);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
