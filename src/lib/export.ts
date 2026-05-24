import type { Editor } from "@tiptap/react";

export async function exportToPdf(_editor: Editor, title: string) {
  const el = document.querySelector(".docpro-page-content") as HTMLElement | null;
  if (!el) return;
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
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
  const { saveAs } = await import("file-saver");
  // @ts-expect-error no types
  const mod = await import("html-to-docx-buffer");
  const htmlToDocx = (mod as any).default ?? mod;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${editor.getHTML()}</body></html>`;
  const buf = await htmlToDocx(html, undefined, { table: { row: { cantSplit: true } } });
  const blob = buf instanceof Blob ? buf : new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  saveAs(blob, `${title || "documento"}.docx`);
}
