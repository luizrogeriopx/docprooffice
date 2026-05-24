import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import LinkExt from "@tiptap/extension-link";
import { ResizableImage } from "@/components/editor/ResizableImage";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableFormulas } from "@/components/editor/TableFormulas";
import { FontSize } from "@/components/editor/FontSize";
import { PageBreak } from "@/components/editor/PageBreak";
import {
  PaginationBreaks,
  paginationBreaksSignature,
  setPaginationBreaks,
  type PaginationBreakSpec,
} from "@/components/editor/PaginationBreaks";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, FileText, Cloud, CloudOff, Check } from "lucide-react";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { AiSidebar } from "@/components/editor/AiSidebar";
import { DocumentsSidebar } from "@/components/editor/DocumentsSidebar";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/doc/$id")({
  component: DocumentPage,
  head: () => ({ meta: [{ title: "Editor — DocPro" }] }),
});

function DocumentPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("Documento sem título");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docLoaded, setDocLoaded] = useState(false);
  const [abntMode, setAbntMode] = useState<string>(""); // "", "abnt", "abnt abnt-arial", "abnt abnt-references", "abnt abnt-cover"
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      LinkExt.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      ResizableImage,
      Placeholder.configure({ placeholder: "Comece a escrever..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TableFormulas,
      FontSize,
      PageBreak,
      PaginationBreaks,
    ],
    content: "",
    onUpdate: () => scheduleSave(),
  });

  // Load doc
  useEffect(() => {
    if (!user || !editor) return;
    (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Documento não encontrado");
        navigate({ to: "/dashboard" });
        return;
      }
      setTitle(data.title);
      const json = data.content as JSONContent | null;
      const isEmptyJson = !json || (json?.content?.length === 1 && !json.content[0]?.content);
      if (isEmptyJson && data.content_html) {
        editor.commands.setContent(data.content_html);
      } else {
        editor.commands.setContent(json ?? "");
      }
      setDocLoaded(true);
    })();
  }, [user, editor, id]);

  const scheduleSave = () => {
    if (!editor || !docLoaded) return;
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 800);
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(snapshotHistory, 30_000);
  };

  const save = async () => {
    if (!editor) return;
    const { error } = await supabase
      .from("documents")
      .update({ title, content: editor.getJSON() as Json, content_html: editor.getHTML() })
      .eq("id", id);
    if (error) {
      setStatus("error");
      toast.error("Erro ao salvar");
    } else {
      setStatus("saved");
      setSavedAt(new Date());
    }
  };

  const snapshotHistory = async () => {
    if (!editor || !user) return;
    await supabase.from("document_history").insert({
      document_id: id,
      user_id: user.id,
      content: editor.getJSON() as Json,
    });
  };

  // Save on title change
  useEffect(() => {
    if (docLoaded) scheduleSave(); /* eslint-disable-next-line */
  }, [title]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-3.5 w-3.5" />
          </div>
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 max-w-md flex-1 rounded-md bg-transparent px-2 py-1 text-sm font-medium outline-none transition focus:bg-accent"
        />
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {status === "saving" && (
            <>
              <Cloud className="h-3.5 w-3.5 animate-pulse" /> Salvando...
            </>
          )}
          {status === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-primary" /> Salvo{" "}
              {savedAt ? savedAt.toLocaleTimeString() : ""}
            </>
          )}
          {status === "error" && (
            <>
              <CloudOff className="h-3.5 w-3.5 text-destructive" /> Erro ao salvar
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DocumentsSidebar currentId={id} userId={user.id} />

        <div className="flex min-w-0 flex-1 flex-col">
          <EditorToolbar
            editor={editor}
            title={title}
            abntMode={abntMode}
            onAbntChange={setAbntMode}
          />
          <div
            className="flex-1 overflow-auto overscroll-contain"
            style={
              {
                touchAction: "pan-y pinch-zoom",
                WebkitOverflowScrolling: "touch",
              } as React.CSSProperties
            }
          >
            <DocPage abntMode={abntMode} editor={editor} />
          </div>
        </div>

        <AiSidebar editor={editor} />
      </div>
    </div>
  );
}

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const A4_PAGE_GAP = 32;

function DocPage({ abntMode, editor }: { abntMode: string; editor: ReturnType<typeof useEditor> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current;
      if (!el) return;
      const styles = window.getComputedStyle(el);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const available = el.clientWidth - horizontalPadding;
      setScale(Math.min(1, Math.max(0, available) / A4_WIDTH));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || !editor) return;

    let frame: number | null = null;
    let observer: ResizeObserver | null = null;
    let previousSignature = "";

    const layout = () => {
      const prose = contentEl.querySelector<HTMLElement>(".ProseMirror");
      if (!prose) return;

      const styles = window.getComputedStyle(contentEl);
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;
      const breaks = Array.from(prose.querySelectorAll<HTMLElement>(".docpro-page-break"));
      const proseRect = prose.getBoundingClientRect();
      const renderedScale = prose.offsetWidth > 0 ? proseRect.width / prose.offsetWidth : scale;
      const visualScale = renderedScale > 0 ? renderedScale : 1;

      Array.from(prose.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child.classList.contains("docpro-page-break")) {
          child.style.setProperty("--docpro-page-break-height", "0px");
        }
      });

      breaks.forEach((pageBreak) => {
        const y = pageBreak.offsetTop;
        const absoluteY = paddingTop + y;
        const pageIndex = Math.floor(Math.max(0, absoluteY - 1) / (A4_HEIGHT + A4_PAGE_GAP));
        const nextPageContentTop = (pageIndex + 1) * (A4_HEIGHT + A4_PAGE_GAP) + paddingTop;
        const height = Math.max(40, nextPageContentTop - absoluteY);
        pageBreak.style.setProperty("--docpro-page-break-height", `${height}px`);
      });

      const autoBreaks: PaginationBreakSpec[] = [];
      const visualLines: Array<{
        left: number;
        top: number;
        docTop: number;
        docBottom: number;
      }> = [];
      const textBlocks = Array.from(
        prose.querySelectorAll<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6, pre"),
      ).filter(
        (block) =>
          !block.closest(".docpro-page-break") &&
          !(block.tagName === "LI" && block.querySelector("p, h1, h2, h3, h4, h5, h6, pre")),
      );

      prose.classList.add("docpro-measuring-pagination");
      try {
        textBlocks.forEach((block) => {
          const range = document.createRange();
          range.selectNodeContents(block);
          const lineRects = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0 && rect.height > 0,
          );
          range.detach();

          if (lineRects.length === 0) return;

          const grouped = new Map<number, DOMRect[]>();
          lineRects.forEach((rect) => {
            const key = Math.round(rect.top * 2) / 2;
            grouped.set(key, [...(grouped.get(key) ?? []), rect]);
          });

          grouped.forEach((rects) => {
            const left = Math.min(...rects.map((rect) => rect.left));
            const top = Math.min(...rects.map((rect) => rect.top));
            const bottom = Math.max(...rects.map((rect) => rect.bottom));
            visualLines.push({
              left,
              top,
              docTop: (top - proseRect.top) / visualScale + paddingTop,
              docBottom: (bottom - proseRect.top) / visualScale + paddingTop,
            });
          });
        });

        // 4. Calculate auto breaks while still in measuring state (hiding existing auto-page-breaks)
        let accumulatedShift = 0;
        visualLines
          .sort((a, b) => a.docTop - b.docTop || a.docBottom - b.docBottom)
          .forEach((currentLine) => {
            const lineTop = currentLine.docTop + accumulatedShift;
            const lineBottom = currentLine.docBottom + accumulatedShift;
            const pageIndex = Math.floor(Math.max(0, lineTop) / (A4_HEIGHT + A4_PAGE_GAP));
            const pageTop = pageIndex * (A4_HEIGHT + A4_PAGE_GAP) + paddingTop;
            const pageBottom = pageIndex * (A4_HEIGHT + A4_PAGE_GAP) + A4_HEIGHT - paddingBottom;

            if (pageIndex > 0 && lineTop < pageTop) {
              const result = editor.view.posAtCoords({
                left: currentLine.left + 1,
                top: currentLine.top + 1,
              });
              if (!result) return;
              const height = Math.max(0, pageTop - lineTop);
              if (height > 0) {
                const existingBreak = autoBreaks.find((b) => b.pos === result.pos);
                if (existingBreak) {
                  if (height > existingBreak.height) {
                    accumulatedShift += height - existingBreak.height;
                    existingBreak.height = height;
                  }
                } else {
                  autoBreaks.push({ pos: result.pos, height });
                  accumulatedShift += height;
                }
              }
            } else if (lineBottom > pageBottom) {
              const result = editor.view.posAtCoords({
                left: currentLine.left + 1,
                top: currentLine.top + 1,
              });
              if (!result) return;
              const nextPageY = (pageIndex + 1) * (A4_HEIGHT + A4_PAGE_GAP) + paddingTop;
              const height = Math.max(0, nextPageY - lineTop);
              if (height > 0) {
                const existingBreak = autoBreaks.find((b) => b.pos === result.pos);
                if (existingBreak) {
                  if (height > existingBreak.height) {
                    accumulatedShift += height - existingBreak.height;
                    existingBreak.height = height;
                  }
                } else {
                  autoBreaks.push({ pos: result.pos, height });
                  accumulatedShift += height;
                }
              }
            }
          });
      } finally {
        prose.classList.remove("docpro-measuring-pagination");
      }

      const signature = paginationBreaksSignature(autoBreaks);
      if (signature !== previousSignature) {
        previousSignature = signature;
        setPaginationBreaks(editor.view, autoBreaks);
        return;
      }

      const contentBottom = Array.from(prose.children).reduce((bottom, child) => {
        if (!(child instanceof HTMLElement)) return bottom;
        const childStyles = window.getComputedStyle(child);
        const marginBottom = parseFloat(childStyles.marginBottom) || 0;
        return Math.max(bottom, child.offsetTop + child.offsetHeight + marginBottom);
      }, 0);
      const measuredHeight = paddingTop + contentBottom + paddingBottom;
      const pages = Math.max(
        1,
        Math.floor(Math.max(0, measuredHeight - 1) / (A4_HEIGHT + A4_PAGE_GAP)) + 1,
      );
      setPageCount((current) => (current === pages ? current : pages));
    };

    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };

    schedule();
    if (editor) {
      editor.on("update", schedule);
      editor.on("transaction", schedule);
    }

    const attachObserver = () => {
      const prose = contentEl.querySelector<HTMLElement>(".ProseMirror");
      if (!prose) return;
      observer = new ResizeObserver(schedule);
      observer.observe(prose);
    };
    requestAnimationFrame(attachObserver);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      if (editor) {
        editor.off("update", schedule);
        editor.off("transaction", schedule);
      }
    };
  }, [editor, abntMode, scale]);

  const pageStride = A4_HEIGHT + A4_PAGE_GAP;
  const contentHeight = pageCount * A4_HEIGHT + Math.max(0, pageCount - 1) * A4_PAGE_GAP;

  return (
    <div className="px-4 py-8 sm:px-6" ref={wrapRef}>
      <div style={{ width: A4_WIDTH * scale, height: contentHeight * scale, marginInline: "auto" }}>
        <div
          ref={pageRef}
          className={`docpro-editor relative ${abntMode}`}
          style={{
            width: A4_WIDTH,
            height: contentHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {Array.from({ length: pageCount }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 w-full rounded-sm bg-page shadow-md ring-1 ring-border"
              style={{ top: index * pageStride, height: A4_HEIGHT }}
            />
          ))}
          <div
            ref={contentRef}
            className={`docpro-page-content relative z-10 px-[96px] py-[96px] ${
              abntMode ? "abnt-page" : ""
            }`}
            style={{ minHeight: contentHeight, width: A4_WIDTH }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
