import type { Editor } from "@tiptap/react";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
// @ts-expect-error no types
import htmlToDocx from "html-to-docx-buffer";

export async function exportToPdf(editor: Editor, title: string) {
  const el = document.querySelector(".docpro-page-content") as HTMLElement | null;
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.height / canvas.width;
  const imgW = pageW;
  const imgH = pageW * ratio;
  let y = 0;
  if (imgH <= pageH) {
    pdf.addImage(img, "PNG", 0, 0, imgW, imgH);
  } else {
    // simple multi-page slicing
    let remaining = imgH;
    while (remaining > 0) {
      pdf.addImage(img, "PNG", 0, -y, imgW, imgH);
      remaining -= pageH;
      y += pageH;
      if (remaining > 0) pdf.addPage();
    }
  }
  pdf.save(`${title || "documento"}.pdf`);
}

export async function exportToDocx(editor: Editor, title: string) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${editor.getHTML()}</body></html>`;
  const buf = await htmlToDocx(html, undefined, { table: { row: { cantSplit: true } } });
  const blob = buf instanceof Blob ? buf : new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `${title || "documento"}.docx`);
}
