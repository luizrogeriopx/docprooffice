import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { FileText, Plus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NewDocumentDialog } from "@/components/dashboard/NewDocumentDialog";

interface Doc { id: string; title: string; updated_at: string; }

export function DocumentsSidebar({ currentId, userId }: { currentId: string; userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data: owned } = await supabase
      .from("documents")
      .select("id,title,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    const { data: collabRows } = await supabase
      .from("document_collaborators")
      .select("document_id")
      .eq("user_id", userId);
    const ids = (collabRows ?? []).map((r) => r.document_id);
    let collabDocs: Doc[] = [];
    if (ids.length) {
      const { data: cd } = await supabase
        .from("documents")
        .select("id,title,updated_at")
        .in("id", ids);
      collabDocs = (cd ?? []) as Doc[];
    }
    const merged = [...((owned as Doc[]) ?? []), ...collabDocs]
      .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
      .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
      .slice(0, 50);
    setDocs(merged);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("docs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentId]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Link to="/dashboard" className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent" title="Voltar">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-semibold">Documentos</span>
        <Button size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0" onClick={() => setOpen(true)} title="Novo">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {docs.map((d) => (
          <Link
            key={d.id}
            to="/doc/$id"
            params={{ id: d.id }}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-accent",
              d.id === currentId && "bg-accent font-medium text-accent-foreground"
            )}
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{d.title || "Sem título"}</span>
          </Link>
        ))}
      </div>
      <NewDocumentDialog open={open} onOpenChange={setOpen} userId={userId} />
    </aside>
  );
}
