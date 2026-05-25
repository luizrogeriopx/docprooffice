import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, LogOut, Loader2, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewDocumentDialog } from "@/components/dashboard/NewDocumentDialog";
import { ShareDialog } from "@/components/ShareDialog";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Meus documentos — DocPro" }] }),
});

interface Doc { id: string; title: string; updated_at: string; content_html: string | null; }

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState<Doc | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    // Documentos próprios
    const { data: owned, error } = await supabase
      .from("documents")
      .select("id,title,updated_at,content_html")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }

    // Documentos em que sou colaborador
    const { data: collabRows } = await supabase
      .from("document_collaborators")
      .select("document_id")
      .eq("user_id", user.id);
    const collabIds = (collabRows ?? []).map((r) => r.document_id);
    let collabDocs: Doc[] = [];
    if (collabIds.length) {
      const { data: cd } = await supabase
        .from("documents")
        .select("id,title,updated_at,content_html")
        .in("id", collabIds);
      collabDocs = (cd ?? []) as Doc[];
    }

    const merged = [...(owned as Doc[]), ...collabDocs]
      .filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i)
      .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
    setDocs(merged);
  };


  useEffect(() => { if (user) load(); }, [user]);

  const openCreate = () => setDialogOpen(true);

  const remove = async (id: string) => {
    if (!user) return;
    // Verifica se sou dono do documento
    const { data: ownRow } = await supabase
      .from("documents")
      .select("user_id")
      .eq("id", id)
      .maybeSingle();
    const isOwner = ownRow?.user_id === user.id;

    if (isOwner) {
      if (!confirm("Excluir este documento? Esta ação não pode ser desfeita.")) return;
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
      toast.success("Documento excluído");
    } else {
      if (!confirm("Remover este documento compartilhado da sua lista?")) return;
      const { error } = await supabase
        .from("document_collaborators")
        .delete()
        .eq("document_id", id)
        .eq("user_id", user.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Você saiu da colaboração");
    }
    load();
  };

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const filtered = docs.filter((d) => d.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </div>
            DocPro
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Meus documentos</h1>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo documento
          </Button>
        </div>

        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>

        {filtered.length === 0 ? (
          <div className="mt-16 grid place-items-center rounded-xl border border-dashed bg-card p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum documento ainda. Crie o primeiro!</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Novo documento</Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <div key={d.id} className="group relative overflow-hidden rounded-lg border bg-card transition hover:shadow-md">
                <Link to="/doc/$id" params={{ id: d.id }} className="block">
                  <div className="relative h-48 overflow-hidden border-b bg-[#e5e7eb]">
                    {d.content_html && d.content_html.trim() ? (
                      <div
                        aria-hidden="true"
                        className="docpro-card-preview pointer-events-none absolute left-0 top-0 bg-white"
                        style={{
                          width: 794,
                          height: 1123,
                          padding: "72px 96px",
                          transform: "scale(0.36)",
                          transformOrigin: "top left",
                          fontFamily: "'Times New Roman', Times, serif",
                          fontSize: "12pt",
                          lineHeight: 1.4,
                          color: "#111",
                        }}
                        dangerouslySetInnerHTML={{ __html: d.content_html }}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <FileText className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </Link>
                <div className="absolute right-2 top-2 flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShareDoc(d); }}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/90 shadow-sm transition hover:bg-primary hover:text-primary-foreground"
                    aria-label="Compartilhar"
                    title="Compartilhar"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); remove(d.id); }}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/90 shadow-sm transition hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Excluir"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <NewDocumentDialog open={dialogOpen} onOpenChange={setDialogOpen} userId={user.id} />
      {shareDoc && (
        <ShareDialog
          open={!!shareDoc}
          onOpenChange={(v) => !v && setShareDoc(null)}
          documentId={shareDoc.id}
          documentTitle={shareDoc.title}
        />
      )}
    </div>
  );
}
