import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import { EditorView } from "@tiptap/pm/view";
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
import { FontFamily } from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import Document from "@tiptap/extension-document";
import { PageBreak } from "@/components/editor/PageBreak";
import {
  PaginationBreaks,
  paginationBreaksSignature,
  setPaginationBreaks,
  type PaginationBreakSpec,
} from "@/components/editor/PaginationBreaks";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, FileText, Cloud, CloudOff, Check, Share2, Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/ShareDialog";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { AiSidebar } from "@/components/editor/AiSidebar";
import { DocumentsSidebar } from "@/components/editor/DocumentsSidebar";
import { PageSettingsDialog } from "@/components/editor/PageSettingsDialog";
import { PageOverlays } from "@/components/editor/PageOverlays";
import {
  DEFAULT_PAGE_SETTINGS,
  loadPageSettings,
  savePageSettings,
  type PageSettings,
} from "@/components/editor/pageSettings";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/doc/$id")({
  component: DocumentPage,
  head: () => ({ meta: [{ title: "Editor — DocPro" }] }),
});

const ABNT_FONT_STYLE = "font-family: 'Times New Roman', Times, serif; font-size: 12pt;";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPlainTextAsAbntHtml(text: string): string {
  const normalized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!normalized) return "";

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap(splitLongParagraph)
    .map((block) => `<p><span style="${ABNT_FONT_STYLE}">${escapeHtml(block)}</span></p>`)
    .join("");
}

function extractPlainTextFromHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.querySelectorAll("style, script, meta, link").forEach((node) => node.remove());
  doc.querySelectorAll("br").forEach((node) => node.replaceWith(doc.createTextNode("\n")));
  doc
    .querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr")
    .forEach((node) => node.appendChild(doc.createTextNode("\n\n")));

  return doc.body.textContent ?? "";
}

function insertAbntHtml(view: EditorView, html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(doc.body);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
}

function formatPastedHtmlAbnt(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  try {
    return formatPlainTextAsAbntHtml(extractPlainTextFromHtml(html));
  } catch {
    return html;
  }
}

const CustomDocument = Document.extend({
  addAttributes() {
    return {
      layout: {
        default: "document",
      },
    };
  },
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
  const [layoutMode, setLayoutMode] = useState<"document" | "presentation">("document");
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [role, setRole] = useState<"owner" | "collab" | "viewer">("viewer");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef(false);
  const lastSavedHtmlRef = useRef<string>("");

  const isPresentation = layoutMode === "presentation";

  // Event listener for setting slide background
  useEffect(() => {
    const handleSetBg = (e: Event) => {
      const { src, pageIndex } = (e as CustomEvent).detail;
      setBackgrounds((prev) => {
        const next = [...prev];
        while (next.length <= pageIndex) {
          next.push("");
        }
        next[pageIndex] = src;
        return next;
      });
      setTimeout(() => {
        scheduleSave();
      }, 50);
    };

    window.addEventListener("docpro-set-background", handleSetBg);
    return () => window.removeEventListener("docpro-set-background", handleSetBg);
  }, [editor, docLoaded, role]);

  const duplicateSlide = (slideIndex: number) => {
    if (!editor) return;
    const doc = editor.state.doc;
    const slides: { start: number; end: number }[] = [];
    let currentStart = 0;
    
    doc.forEach((node, offset) => {
      if (node.type.name === "pageBreak") {
        slides.push({
          start: currentStart,
          end: offset
        });
        currentStart = offset;
      }
    });
    slides.push({
      start: currentStart,
      end: doc.content.size
    });
    
    if (slideIndex < 0 || slideIndex >= slides.length) return;
    const target = slides[slideIndex];
    
    const slice = doc.slice(target.start, target.end);
    const jsonContent = slice.content.toJSON();
    
    setBackgrounds((prev) => {
      const next = [...prev];
      const bg = next[slideIndex] || "";
      next.splice(slideIndex + 1, 0, bg);
      return next;
    });
    
    editor.chain()
      .focus()
      .insertContentAt(target.end, [
        { type: "pageBreak" },
        ...jsonContent
      ])
      .run();
      
    toast.success("Slide duplicado");
    setTimeout(() => {
      scheduleSave();
      setUpdateTrigger(prev => prev + 1);
    }, 100);
  };

  const deleteSlide = (slideIndex: number) => {
    if (!editor) return;
    const doc = editor.state.doc;
    const slides: { start: number; end: number; hasBreakBefore: boolean }[] = [];
    let currentStart = 0;
    let hasBreakBefore = false;
    
    doc.forEach((node, offset) => {
      if (node.type.name === "pageBreak") {
        slides.push({
          start: currentStart,
          end: offset,
          hasBreakBefore
        });
        currentStart = offset;
        hasBreakBefore = true;
      }
    });
    slides.push({
      start: currentStart,
      end: doc.content.size,
      hasBreakBefore
    });
    
    if (slideIndex < 0 || slideIndex >= slides.length) return;
    if (slides.length <= 1) {
      toast.error("Não é possível excluir o único slide.");
      return;
    }
    
    const target = slides[slideIndex];
    
    let from = target.start;
    let to = target.end;
    
    if (target.hasBreakBefore) {
      from = target.start;
    } else {
      to = target.end + 1;
    }
    
    setBackgrounds((prev) => {
      const next = [...prev];
      next.splice(slideIndex, 1);
      return next;
    });
    
    editor.chain()
      .focus()
      .deleteRange(from, Math.min(doc.content.size, to))
      .run();
      
    toast.success("Slide excluído");
    setTimeout(() => {
      scheduleSave();
      setUpdateTrigger(prev => prev + 1);
    }, 100);
  };

  const addSlide = () => {
    if (!editor) return;
    const doc = editor.state.doc;
    const insertPos = doc.content.size;
    
    setBackgrounds((prev) => [...prev, ""]);
    
    editor.chain()
      .focus()
      .insertContentAt(insertPos, [
        { type: "pageBreak" },
        { type: "paragraph" }
      ])
      .run();
      
    setTimeout(() => {
      scheduleSave();
      setUpdateTrigger(prev => prev + 1);
    }, 100);
  };

  const scrollToSlide = (slideIndex: number) => {
    const scrollContainer = document.querySelector(".overflow-auto");
    if (scrollContainer) {
      const offsetTop = slideIndex * 478;
      scrollContainer.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      });
    }
  };

  const getSlidesJSON = () => {
    if (!editor) return [];
    const doc = editor.state.doc;
    const slides: any[][] = [[]];
    let currentIdx = 0;
    
    doc.forEach((node) => {
      if (node.type.name === "pageBreak") {
        currentIdx++;
        slides[currentIdx] = [];
      } else {
        slides[currentIdx].push(node.toJSON());
      }
    });
    return slides;
  };

  // Note: login no longer forced — view links work for anonymous users.

  // Load page settings (footer / page numbers / watermark)
  useEffect(() => {
    setPageSettings(loadPageSettings(id));
  }, [id]);

  const updatePageSettings = (next: PageSettings) => {
    setPageSettings(next);
    savePageSettings(id, next);
  };

  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false,
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
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
      FontFamily.configure({ types: ["textStyle"] }),
      Color.configure({ types: ["textStyle"] }),
      Highlight.configure({ multicolor: true }),
      PageBreak,
      PaginationBreaks,
    ],
    content: "",
    editorProps: {
      transformPastedHTML: (html) => formatPastedHtmlAbnt(html),
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;

        const source = clipboard.getData("text/html") || clipboard.getData("text/plain");
        const html = clipboard.getData("text/html")
          ? formatPastedHtmlAbnt(source)
          : formatPlainTextAsAbntHtml(source);

        if (!html) return false;
        event.preventDefault();
        insertAbntHtml(view, html);
        return true;
      },
    },
    onUpdate: () => {
      scheduleSave();
      setUpdateTrigger((prev) => prev + 1);
    },
  });

  // Load doc
  useEffect(() => {
    if (loading || !editor) return;
    (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Documento não encontrado");
        navigate({ to: user ? "/dashboard" : "/" });
        return;
      }
      // determine role
      let r: "owner" | "collab" | "viewer" = "viewer";
      if (user && data.user_id === user.id) r = "owner";
      else if (user) {
        const { data: c } = await supabase
          .from("document_collaborators")
          .select("user_id")
          .eq("document_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (c) r = "collab";
      }
      setRole(r);

      setTitle(data.title);
      const json = data.content as JSONContent | null;
      const initialLayout = json?.attrs?.layout === "presentation" ? "presentation" : "document";
      setLayoutMode(initialLayout);
      setBackgrounds(json?.attrs?.backgrounds || []);
      const isEmptyJson = !json || (json?.content?.length === 1 && !json.content[0]?.content);
      applyingRemoteRef.current = true;
      if (isEmptyJson && data.content_html) {
        editor.commands.setContent(data.content_html);
      } else {
        editor.commands.setContent(json ?? "");
      }
      lastSavedHtmlRef.current = editor.getHTML();
      applyingRemoteRef.current = false;
      editor.setEditable(r !== "viewer");
      setDocLoaded(true);
    })();
  }, [loading, user, editor, id]);

  // Realtime sync for collaborators / owner
  useEffect(() => {
    if (!docLoaded || !editor || role === "viewer") return;
    const ch = supabase
      .channel(`doc-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "documents", filter: `id=eq.${id}` },
        (payload) => {
          const newHtml = (payload.new as { content_html?: string }).content_html ?? "";
          if (!newHtml || newHtml === lastSavedHtmlRef.current) return;
          if (status === "saving") return; // don't clobber local edits in flight
          
          const newContent = (payload.new as { content?: any }).content;
          if (newContent && newContent.attrs?.backgrounds) {
            setBackgrounds(newContent.attrs.backgrounds);
          }
          
          applyingRemoteRef.current = true;
          const { from, to } = editor.state.selection;
          editor.commands.setContent(newHtml, { emitUpdate: false });
          try { editor.commands.setTextSelection({ from, to }); } catch {}
          lastSavedHtmlRef.current = newHtml;
          applyingRemoteRef.current = false;
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [docLoaded, editor, id, role, status]);

  const scheduleSave = () => {
    if (!editor || !docLoaded) return;
    if (applyingRemoteRef.current) return;
    if (role === "viewer") return;
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 800);
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(snapshotHistory, 30_000);
  };

  const save = async () => {
    if (!editor) return;
    if (role === "viewer") return;
    const html = editor.getHTML();
    const json = editor.getJSON() as any;
    if (json) {
      if (!json.attrs) json.attrs = {};
      json.attrs.layout = layoutMode;
      json.attrs.backgrounds = backgrounds;
    }
    const updates: { title: string; content: Json; content_html: string } = {
      title, content: json as Json, content_html: html,
    };
    const { error } = await supabase.from("documents").update(updates).eq("id", id);
    if (error) {
      setStatus("error");
      toast.error("Erro ao salvar");
    } else {
      lastSavedHtmlRef.current = html;
      setStatus("saved");
      setSavedAt(new Date());
    }
  };

  const snapshotHistory = async () => {
    if (!editor || !user) return;
    const json = editor.getJSON() as any;
    if (json) {
      if (!json.attrs) json.attrs = {};
      json.attrs.layout = layoutMode;
      json.attrs.backgrounds = backgrounds;
    }
    await supabase.from("document_history").insert({
      document_id: id,
      user_id: user.id,
      content: json as Json,
    });
  };

  // Save on title change
  useEffect(() => {
    if (docLoaded && role !== "viewer") scheduleSave(); /* eslint-disable-next-line */
  }, [title]);

  if (loading) {
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
          {role === "owner" && (
            <Button variant="outline" size="sm" className="ml-2" onClick={() => setShareOpen(true)}>
              <Share2 className="mr-2 h-3.5 w-3.5" /> Compartilhar
            </Button>
          )}
          {role === "viewer" && (
            <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-xs">Somente leitura</span>
          )}
          {role === "collab" && (
            <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">Colaborando</span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {user && role !== "viewer" && <DocumentsSidebar currentId={id} userId={user.id} />}

        {/* PowerPoint-style Slide Sidebar */}
        {isPresentation && editor && (
          <div className="w-56 shrink-0 border-r bg-background flex flex-col min-h-0 select-none">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">Slides</span>
              {role !== "viewer" && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={addSlide} title="Adicionar Slide">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {getSlidesJSON().map((slideNodes, idx) => (
                <div key={idx} className="flex gap-2 items-start group">
                  <span className="text-xs text-muted-foreground mt-8 font-medium w-3 text-right">
                    {idx + 1}
                  </span>
                  <div className="flex-1 flex flex-col gap-1.5">
                    {/* Thumbnail Card */}
                    <div 
                      onClick={() => scrollToSlide(idx)}
                      className="relative border border-border rounded-lg bg-white shadow-sm cursor-pointer overflow-hidden aspect-video transition hover:border-primary hover:ring-1 hover:ring-primary flex-shrink-0"
                      style={{ 
                        backgroundImage: backgrounds[idx] ? `url(${backgrounds[idx]})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {/* Live text/layout preview scaled down */}
                      <div 
                        className="absolute inset-0 p-2 origin-top-left pointer-events-none select-none text-[3px] leading-tight overflow-hidden text-slate-800"
                        style={{
                          width: 794,
                          height: 446,
                          transform: 'scale(0.18)',
                        }}
                      >
                        {slideNodes.map((node: any, i: number) => {
                          if (node.type === "paragraph") {
                            return <p key={i} className="mb-1 opacity-70 truncate">{node.content?.[0]?.text || ""}</p>;
                          }
                          if (node.type === "heading") {
                            const level = node.attrs?.level || 1;
                            const sizeClass = level === 1 ? "font-bold text-[10px]" : "font-bold";
                            return <p key={i} className={`${sizeClass} mb-1 truncate text-primary`}>{node.content?.[0]?.text || ""}</p>;
                          }
                          if (node.type === "resizableImage") {
                            return <img key={i} src={node.attrs?.src} className="max-w-[40%] max-h-[30%] object-contain mb-1 rounded inline-block" />;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                    {/* Slide Controls (Duplicate / Delete) */}
                    {role !== "viewer" && (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => duplicateSlide(idx)}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 px-1 py-0.5 hover:bg-accent rounded"
                          title="Duplicar"
                        >
                          <Copy className="h-3 w-3" />
                          Duplicar
                        </button>
                        <button 
                          onClick={() => deleteSlide(idx)}
                          className="text-[10px] text-destructive hover:text-destructive/80 flex items-center gap-0.5 px-1 py-0.5 hover:bg-destructive/10 rounded"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {role !== "viewer" && (
            <EditorToolbar
              editor={editor}
              title={title}
              abntMode={abntMode}
              onAbntChange={setAbntMode}
              onOpenPageSettings={() => setPageSettingsOpen(true)}
            />
          )}
          <div
            className="flex-1 overflow-auto overscroll-contain"
            style={
              {
                touchAction: "pan-y pinch-zoom",
                WebkitOverflowScrolling: "touch",
              } as React.CSSProperties
            }
          >
            <DocPage 
              abntMode={abntMode} 
              editor={editor} 
              pageSettings={pageSettings} 
              layoutMode={layoutMode} 
              backgrounds={backgrounds} 
            />
          </div>
        </div>

        {role !== "viewer" && <AiSidebar editor={editor} />}
      </div>

      <PageSettingsDialog
        open={pageSettingsOpen}
        onOpenChange={setPageSettingsOpen}
        value={pageSettings}
        onChange={updatePageSettings}
      />
      {role === "owner" && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          documentId={id}
          documentTitle={title}
        />
      )}
    </div>
  );
}

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const A4_PAGE_GAP = 32;
const PASTED_PARAGRAPH_TARGET_CHARS = 1200;

function splitLongParagraph(block: string): string[] {
  const normalized = block.replace(/\s+/g, " ").trim();
  if (normalized.length <= PASTED_PARAGRAPH_TARGET_CHARS) return [normalized];

  const chunks: string[] = [];
  const sentences = normalized.match(/[^.!?;:]+[.!?;:]?|\S+/g) ?? [normalized];
  let current = "";

  sentences.forEach((sentence) => {
    const next = sentence.trim();
    if (!next) return;
    if (current && `${current} ${next}`.length > PASTED_PARAGRAPH_TARGET_CHARS) {
      chunks.push(current);
      current = next;
    } else {
      current = current ? `${current} ${next}` : next;
    }
  });

  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= PASTED_PARAGRAPH_TARGET_CHARS * 1.25) return [chunk];
    const parts: string[] = [];
    const words = chunk.split(" ");
    let currentPart = "";
    words.forEach((word) => {
      if (currentPart && `${currentPart} ${word}`.length > PASTED_PARAGRAPH_TARGET_CHARS) {
        parts.push(currentPart);
        currentPart = word;
      } else {
        currentPart = currentPart ? `${currentPart} ${word}` : word;
      }
    });
    if (currentPart) parts.push(currentPart);
    return parts;
  });
}

function getBlockDocumentPosition(view: EditorView, block: HTMLElement): number | null {
  let found: number | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found !== null || !node.isBlock) return false;
    if (view.nodeDOM(pos) === block) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

function findLineStartPos(
  view: EditorView,
  block: HTMLElement,
  lineTop: number,
  blockStartPos: number,
): number {
  const text = block.textContent || "";
  if (!text) return blockStartPos;

  const textNodes: Text[] = [];
  const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walk.nextNode())) {
    textNodes.push(node as Text);
  }
  if (textNodes.length === 0) return blockStartPos;

  let low = 0;
  let high = text.length - 1;
  let bestPos = blockStartPos;
  let minDiff = Infinity;

  const range = document.createRange();

  const getDOMPos = (index: number): { node: Text; offset: number } | null => {
    let acc = 0;
    for (const tNode of textNodes) {
      if (index >= acc && index <= acc + tNode.length) {
        return { node: tNode, offset: index - acc };
      }
      acc += tNode.length;
    }
    return null;
  };

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const domPos = getDOMPos(mid);
    if (!domPos) break;

    range.setStart(domPos.node, domPos.offset);
    range.setEnd(domPos.node, Math.min(domPos.node.length, domPos.offset + 1));
    const rects = range.getClientRects();

    if (rects.length > 0) {
      const rectTop = rects[0].top;
      const diff = Math.abs(rectTop - lineTop);

      if (diff < minDiff) {
        minDiff = diff;
        try {
          bestPos = view.posAtDOM(domPos.node, domPos.offset);
        } catch (e) {
          // ignore
        }
      }

      if (rectTop < lineTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } else {
      high = mid - 1;
    }
  }

  return bestPos;
}

function DocPage({
  abntMode,
  editor,
  pageSettings,
  layoutMode,
  backgrounds,
}: {
  abntMode: string;
  editor: ReturnType<typeof useEditor>;
  pageSettings: PageSettings;
  layoutMode: "document" | "presentation";
  backgrounds: string[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const pageCountRef = useRef(1);

  const isPresentation = layoutMode === "presentation";
  const pageHeight = isPresentation ? 446 : A4_HEIGHT;

  useEffect(() => {
    pageCountRef.current = pageCount;
  }, [pageCount]);

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
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    let isPaginating = false;
    let lastDocSignature = "";

    const layout = () => {
      isPaginating = true;
      try {
        const prose = contentEl.querySelector<HTMLElement>(".ProseMirror");
        if (!prose) return;

        // Disconnect observer temporarily to prevent resize loop during class toggling
        if (observer) {
          observer.disconnect();
        }

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
          const pageIndex = Math.floor(Math.max(0, absoluteY - 1) / (pageHeight + A4_PAGE_GAP));
          const nextPageContentTop = (pageIndex + 1) * (pageHeight + A4_PAGE_GAP) + paddingTop;
          const height = Math.max(40, nextPageContentTop - absoluteY);
          pageBreak.style.setProperty("--docpro-page-break-height", `${height}px`);
        });

        const autoBreaks: PaginationBreakSpec[] = [];
        const visualLines: Array<{
          left: number;
          top: number;
          docTop: number;
          docBottom: number;
          block: HTMLElement;
          blockStartPos: number;
        }> = [];

        // Extract all text blocks that are part of the main flow
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
            let blockStartPos = 0;
            try {
              blockStartPos = editor.view.posAtDOM(block, 0);
            } catch (e) {
              return;
            }

            const range = document.createRange();
            range.selectNodeContents(block);
            const lineRects = Array.from(range.getClientRects()).filter(
              (rect) => rect.width > 0 && rect.height > 0,
            );
            range.detach();

            if (lineRects.length === 0) return;

            // Group client rects by line (roughly same top coordinate)
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
                block,
                blockStartPos,
                docTop: (top - proseRect.top) / visualScale + paddingTop,
                docBottom: (bottom - proseRect.top) / visualScale + paddingTop,
              });
            });
          });
        } finally {
          prose.classList.remove("docpro-measuring-pagination");
          // Reconnect observer
          if (observer && prose) {
            observer.observe(prose);
          }
        }

        // Calculate auto breaks line-by-line
        let accumulatedShift = 0;
        let measuredBottom = paddingTop + paddingBottom;

        visualLines
          .sort((a, b) => a.docTop - b.docTop || a.docBottom - b.docBottom)
          .forEach((currentLine) => {
            const lineTop = currentLine.docTop + accumulatedShift;
            const lineBottom = currentLine.docBottom + accumulatedShift;
            const pageIndex = Math.floor(Math.max(0, lineTop) / (pageHeight + A4_PAGE_GAP));
            const pageTop = pageIndex * (pageHeight + A4_PAGE_GAP) + paddingTop;
            const pageBottom = pageIndex * (pageHeight + A4_PAGE_GAP) + pageHeight - paddingBottom;

            if (pageIndex > 0 && lineTop < pageTop) {
              const pos = findLineStartPos(
                editor.view,
                currentLine.block,
                currentLine.top,
                currentLine.blockStartPos,
              );
              const height = Math.max(0, pageTop - lineTop);
              if (height > 0) {
                const existingBreak = autoBreaks.find((b) => b.pos === pos);
                if (existingBreak) {
                  if (height > existingBreak.height) {
                    accumulatedShift += height - existingBreak.height;
                    existingBreak.height = height;
                  }
                } else {
                  autoBreaks.push({ pos, height });
                  accumulatedShift += height;
                }
              }
            } else if (lineBottom > pageBottom) {
              const pos = findLineStartPos(
                editor.view,
                currentLine.block,
                currentLine.top,
                currentLine.blockStartPos,
              );
              const nextPageY = (pageIndex + 1) * (pageHeight + A4_PAGE_GAP) + paddingTop;
              const height = Math.max(0, nextPageY - lineTop);
              if (height > 0) {
                const existingBreak = autoBreaks.find((b) => b.pos === pos);
                if (existingBreak) {
                  if (height > existingBreak.height) {
                    accumulatedShift += height - existingBreak.height;
                    existingBreak.height = height;
                  }
                } else {
                  autoBreaks.push({ pos, height });
                  accumulatedShift += height;
                }
              }
            }

            measuredBottom = Math.max(measuredBottom, lineBottom + paddingBottom);
          });

        autoBreaks.sort((a, b) => a.pos - b.pos || b.height - a.height);

        const signature = paginationBreaksSignature(autoBreaks);
        if (signature !== previousSignature) {
          previousSignature = signature;
          setPaginationBreaks(editor.view, autoBreaks);
        }

        const measuredHeight = measuredBottom;
        const pages = Math.max(
          1,
          Math.floor(Math.max(0, measuredHeight - 1) / (pageHeight + A4_PAGE_GAP)) + 1,
        );
        if (pageCountRef.current !== pages) {
          pageCountRef.current = pages;
          setPageCount(pages);
        }
      } finally {
        isPaginating = false;
      }
    };

    const schedule = (force = false) => {
      if (isPaginating) return;
      const prose = contentEl.querySelector<HTMLElement>(".ProseMirror");
      const measuredHeight = prose?.scrollHeight ?? 0;
      const docSignature = `${editor.state.doc.content.size}:${editor.state.doc.childCount}:${abntMode}:${scale}:${measuredHeight}:${layoutMode}`;
      if (!force && docSignature === lastDocSignature) return;
      lastDocSignature = docSignature;
      if (frame !== null) cancelAnimationFrame(frame);
      if (debounceTimeout !== null) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        frame = requestAnimationFrame(layout);
      }, 100);
    };

    const scheduleEvt = () => schedule();
    schedule();
    if (editor) {
      editor.on("update", scheduleEvt);
      editor.on("transaction", scheduleEvt);
    }

    // Re-paginate when the rendered size changes (image load, resize, font swap).
    const resizeObserver = new ResizeObserver(() => schedule());
    resizeObserver.observe(contentEl);
    const proseEl = contentEl.querySelector<HTMLElement>(".ProseMirror");
    if (proseEl) resizeObserver.observe(proseEl);

    // Image load events (capture phase to catch nested <img>).
    const onImgLoad = (e: Event) => {
      if ((e.target as HTMLElement)?.tagName === "IMG") schedule(true);
    };
    contentEl.addEventListener("load", onImgLoad, true);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (debounceTimeout !== null) clearTimeout(debounceTimeout);
      if (editor) {
        editor.off("update", scheduleEvt);
        editor.off("transaction", scheduleEvt);
      }
      resizeObserver.disconnect();
      contentEl.removeEventListener("load", onImgLoad, true);
    };
  }, [editor, abntMode, scale, layoutMode, pageHeight]);

  const pageStride = pageHeight + A4_PAGE_GAP;
  const contentHeight = pageCount * pageHeight + Math.max(0, pageCount - 1) * A4_PAGE_GAP;

  return (
    <div className="px-4 py-8 sm:px-6" ref={wrapRef}>
      <div style={{ width: A4_WIDTH * scale, height: contentHeight * scale, marginInline: "auto" }}>
        <div
          ref={pageRef}
          className={`docpro-editor relative ${isPresentation ? "presentation" : abntMode}`}
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
              style={{ 
                top: index * pageStride, 
                height: pageHeight,
                backgroundImage: backgrounds && backgrounds[index] ? `url(${backgrounds[index]})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))}
          <div
            ref={contentRef}
            className={`docpro-page-content relative z-10 px-[96px] py-[96px] ${
              isPresentation ? "presentation-page" : abntMode ? "abnt-page" : ""
            }`}
            style={{ minHeight: contentHeight, width: A4_WIDTH }}
          >
            <EditorContent editor={editor} />
            <PageOverlays
              settings={pageSettings}
              pageCount={pageCount}
              pageStride={pageStride}
              pageHeight={pageHeight}
              pageWidth={A4_WIDTH}
              marginX={isPresentation ? 48 : 96}
              marginY={isPresentation ? 32 : 96}
            />
          </div>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
