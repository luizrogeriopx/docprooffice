import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2, FileText, Cloud, CloudOff, Check } from "lucide-react";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { AiSidebar } from "@/components/editor/AiSidebar";
import { DocumentsSidebar } from "@/components/editor/DocumentsSidebar";
import { toast } from "sonner";

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
      LinkExt.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      ResizableImage,
      Placeholder.configure({ placeholder: "Comece a escrever..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      TableFormulas,
      FontSize,
      PageBreak,
    ],
    content: "",
    onUpdate: () => scheduleSave(),
  });

  // Load doc
  useEffect(() => {
    if (!user || !editor) return;
    (async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("Documento não encontrado"); navigate({ to: "/dashboard" }); return; }
      setTitle(data.title);
      const json = data.content as any;
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
      .update({ title, content: editor.getJSON() as any, content_html: editor.getHTML() })
      .eq("id", id);
    if (error) { setStatus("error"); toast.error("Erro ao salvar"); }
    else { setStatus("saved"); setSavedAt(new Date()); }
  };

  const snapshotHistory = async () => {
    if (!editor || !user) return;
    await supabase.from("document_history").insert({
      document_id: id,
      user_id: user.id,
      content: editor.getJSON() as any,
    });
  };

  // Save on title change
  useEffect(() => { if (docLoaded) scheduleSave(); /* eslint-disable-next-line */ }, [title]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center bg-canvas"><Loader2 className="h-6 w-6 animate-spin" /></div>;
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
          {status === "saving" && (<><Cloud className="h-3.5 w-3.5 animate-pulse" /> Salvando...</>)}
          {status === "saved" && (<><Check className="h-3.5 w-3.5 text-primary" /> Salvo {savedAt ? savedAt.toLocaleTimeString() : ""}</>)}
          {status === "error" && (<><CloudOff className="h-3.5 w-3.5 text-destructive" /> Erro ao salvar</>)}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DocumentsSidebar currentId={id} userId={user.id} />

        <div className="flex min-w-0 flex-1 flex-col">
          <EditorToolbar editor={editor} title={title} abntMode={abntMode} onAbntChange={setAbntMode} />
          <div className="flex-1 overflow-auto overscroll-contain" style={{ touchAction: "pan-y pinch-zoom", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
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

function DocPage({ abntMode, editor }: { abntMode: string; editor: ReturnType<typeof useEditor> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT);

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
    const el = pageRef.current;
    if (!el) return;
    const update = () => {
      const h = el.scrollHeight;
      const pages = Math.max(1, Math.ceil(h / A4_HEIGHT));
      setContentHeight(pages * A4_HEIGHT);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor]);

  return (
    <div className="px-4 py-8 sm:px-6" ref={wrapRef}>
      <div style={{ width: A4_WIDTH * scale, height: contentHeight * scale, marginInline: "auto" }}>
        <div
          ref={pageRef}
          className={`docpro-editor rounded-sm bg-page shadow-md ring-1 ring-black/5 ${abntMode}`}
          style={{ width: A4_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <div
            className={`docpro-page-content px-[96px] py-[96px] ${abntMode ? "abnt-page" : ""}`}
            style={{ minHeight: A4_HEIGHT, width: A4_WIDTH }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}

