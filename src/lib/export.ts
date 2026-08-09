import type { Editor } from "@tiptap/react";
import { createServerFn } from "@tanstack/react-start";

export const generateDocxServer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const input = d as { html: string; title: string; abntMode?: string };
    return input;
  })
  .handler(async ({ data }) => {
    // @ts-expect-error - html-to-docx-buffer lacks declaration types
    const mod = await import("html-to-docx-buffer");
    const htmlToDocx = (mod as any).default ?? mod;

    const defaultMargins = {
      top: 1440,
      bottom: 1440,
      left: 1440,
      right: 1440,
    };

    const docxOptions: any = {
      table: { row: { cantSplit: true } },
      title: data.title || "documento",
      margins: defaultMargins,
      margin: defaultMargins,
    };

    if (data.abntMode && data.abntMode.includes("abnt")) {
      const abntMargins = {
        top: 1700,
        bottom: 1134,
        left: 1700,
        right: 1134,
      };
      docxOptions.margins = abntMargins;
      docxOptions.margin = abntMargins;
    }

    const buf = await htmlToDocx(data.html, undefined, docxOptions);
    const base64 = Buffer.from(buf).toString("base64");
    return { base64 };
  });

export async function exportToPdf(_editor: Editor, title: string) {
  const el = document.querySelector(".docpro-page-content") as HTMLElement | null;
  if (!el) {
    console.error("[export] .docpro-page-content not found");
    return;
  }
  try {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas-pro"),
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
  } catch (err) {
    console.error("[export] PDF generation failed", err);
    const { toast } = await import("sonner");
    toast.error("Falha ao gerar PDF. Veja o console.");
  }
}

export async function exportToDocx(editor: Editor | null, title: string, abntMode?: string) {
  if (!editor) {
    console.error("[export] Editor is null or not initialized");
    const { toast } = await import("sonner");
    toast.error("O editor não está inicializado.");
    return;
  }

  try {
    const { saveAs } = await import("file-saver");

    const rawHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${editor.getHTML()}</body></html>`;
    
    // Transform HTML to embed styling inline for DOCX parser compatibility
    let html = rawHtml;
    if (typeof window !== "undefined") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");
      let fontFamily = "Arial, sans-serif";
      if (abntMode && abntMode.includes("abnt")) {
        fontFamily = abntMode.includes("abnt-arial") ? "Arial, sans-serif" : "'Times New Roman', Times, serif";
      }

      doc.body.style.fontFamily = fontFamily;
      doc.body.style.fontSize = "12pt";

      doc.querySelectorAll("p").forEach((p) => {
        p.style.fontFamily = fontFamily;
        p.style.fontSize = "12pt";
        p.style.margin = "0 0 8pt 0";

        if (abntMode && abntMode.includes("abnt")) {
          p.style.margin = "0";
          if (abntMode.includes("abnt-cover")) {
            p.style.textAlign = "center";
            p.style.textTransform = "uppercase";
            p.style.lineHeight = "1.5";
          } else if (abntMode.includes("abnt-references")) {
            p.style.textAlign = "left";
            p.style.textIndent = "0";
            p.style.lineHeight = "1.0";
            p.style.margin = "0 0 6pt 0";
          } else {
            p.style.textAlign = "justify";
            p.style.textIndent = "1.25cm";
            p.style.lineHeight = "1.5";
          }
        }
      });

      doc.querySelectorAll("blockquote").forEach((bq) => {
        bq.style.fontFamily = fontFamily;
        bq.style.fontSize = "10pt";
        bq.style.lineHeight = "1.0";
        bq.style.marginLeft = "4cm";
        bq.style.textIndent = "0";
        bq.style.border = "none";
        bq.style.padding = "0";
      });

      doc.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((h) => {
        h.style.fontFamily = fontFamily;
        h.style.lineHeight = "1.5";
        h.style.margin = "12pt 0 6pt 0";
        
        if (abntMode && abntMode.includes("abnt")) {
          h.style.fontSize = "12pt";
          h.style.fontWeight = "bold";
          h.style.margin = "0 0 12pt 0";
          if (h.tagName === "H1") {
            h.style.textTransform = "uppercase";
          }
        } else {
          const level = parseInt(h.tagName.substring(1), 10);
          const sizes = ["24pt", "18pt", "14pt", "12pt", "11pt", "10pt"];
          h.style.fontSize = sizes[level - 1] || "12pt";
        }
      });

      html = doc.documentElement.outerHTML;
    }

    // Call the server function to build DOCX
    const res = await generateDocxServer({ data: { html, title, abntMode } });
    
    // Decode base64 to binary
    const binary = atob(res.base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    
    saveAs(blob, `${title || "documento"}.docx`);
  } catch (err: any) {
    console.error("[export] DOCX generation failed", err);
    const { toast } = await import("sonner");
    toast.error(`Falha ao gerar DOCX: ${err.message || err}`);
  }
}

export async function exportToPptx(editor: Editor, title: string) {
  const pptxgen = (await import("pptxgenjs")).default;
  const pptx = new pptxgen();

  // Set layout to built-in 16:9 widescreen
  pptx.layout = "LAYOUT_16x9";

  const prose = document.querySelector(".ProseMirror") as HTMLElement | null;
  if (!prose) return;

  type SlideItem = {
    text: string;
    tagName: string;
    textAlign: string;
  };

  const slides: SlideItem[][] = [[]];
  let currentSlideIndex = 0;

  function splitElementByPageBreaks(element: HTMLElement): string[] {
    const segments: string[] = [""];

    function traverse(node: Node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (
          el.classList.contains("docpro-auto-page-break") ||
          el.classList.contains("docpro-page-break")
        ) {
          segments.push("");
          return;
        }

        if (el.querySelector(".docpro-auto-page-break, .docpro-page-break")) {
          for (let i = 0; i < el.childNodes.length; i++) {
            traverse(el.childNodes[i]);
          }
        } else {
          segments[segments.length - 1] += el.textContent || "";
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        segments[segments.length - 1] += node.textContent || "";
      }
    }

    for (let i = 0; i < element.childNodes.length; i++) {
      traverse(element.childNodes[i]);
    }

    return segments.map((s) => s.trim()).filter(Boolean);
  }

  // Segment elements by page breaks (both manual and auto page breaks)
  Array.from(prose.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;

    const isManualBreak = child.classList.contains("docpro-page-break");

    if (isManualBreak) {
      currentSlideIndex++;
      slides[currentSlideIndex] = [];
      return;
    }

    const segments = splitElementByPageBreaks(child);
    segments.forEach((segmentText, idx) => {
      if (idx > 0) {
        currentSlideIndex++;
        slides[currentSlideIndex] = [];
      }
      slides[currentSlideIndex].push({
        text: segmentText,
        tagName: child.tagName,
        textAlign: child.style.textAlign || "left",
      });
    });
  });

  slides.forEach((items) => {
    if (items.length === 0) return;
    const slide = pptx.addSlide();

    let y = 0.5; // Start y offset in inches
    const slideWidth = 10;
    const paddingX = 0.8;

    items.forEach((item) => {
      let fontSize = 16;
      let bold = false;
      let color = "1e293b"; // slate-800
      let h = 0.4;

      if (item.tagName === "H1") {
        fontSize = 36;
        bold = true;
        color = "0f52ba"; // sapphire blue brand
        h = 0.8;
      } else if (item.tagName === "H2") {
        fontSize = 28;
        bold = true;
        color = "0f52ba";
        h = 0.6;
      } else if (item.tagName === "H3" || item.tagName === "H4") {
        fontSize = 22;
        bold = true;
        color = "1e293b";
        h = 0.5;
      } else if (item.tagName === "BLOCKQUOTE") {
        fontSize = 18;
        color = "475569"; // slate-600
        h = 0.5;
      }

      slide.addText(item.text, {
        x: paddingX,
        y: y,
        w: slideWidth - 2 * paddingX,
        h: h,
        fontSize: fontSize,
        bold: bold,
        color: color,
        align:
          item.textAlign === "center" ? "center" : item.textAlign === "right" ? "right" : "left",
      });

      y += h + 0.15; // spacing
    });
  });

  pptx.writeFile({ fileName: `${title || "apresentacao"}.pptx` });
}
