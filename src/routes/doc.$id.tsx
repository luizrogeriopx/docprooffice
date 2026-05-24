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
          <EditorToolbar editor={editor} title={title} />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto my-8 w-full max-w-[816px] px-4">
              <div className="docpro-editor rounded-sm bg-page shadow-md ring-1 ring-black/5">
                <div className="docpro-page-content min-h-[1056px] px-[96px] py-[96px]">
                  <EditorContent editor={editor} />
                </div>
              </div>
              <div className="h-12" />
            </div>
          </div>
        </div>

        <AiSidebar editor={editor} />
      </div>
    </div>
  );
}
