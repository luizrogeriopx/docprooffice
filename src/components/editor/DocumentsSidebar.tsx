import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Doc { id: string; title: string; updated_at: string; }

export function DocumentsSidebar({ currentId, userId }: { currentId: string; userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await supabase.from("documents").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(50);
    if (data) setDocs(data as Doc[]);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("docs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentId]);

  const create = async () => {
    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: userId, title: "Documento sem título" })
      .select("id")
      .single();
    if (!error && data) navigate({ to: "/doc/$id", params: { id: data.id } });
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Link to="/dashboard" className="grid h-8 w-8 place-items-center rounded-md hover:bg-accent" title="Voltar">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-semibold">Documentos</span>
        <Button size="sm" variant="ghost" className="ml-auto h-8 w-8 p-0" onClick={create} title="Novo">
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
    </aside>
  );
}
