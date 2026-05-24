import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, LogOut, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Meus documentos — DocPro" }] }),
});

interface Doc { id: string; title: string; updated_at: string; }

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setDocs(data as Doc[]);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const create = async () => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: user.id, title: "Documento sem título" })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/doc/$id", params: { id: data.id } });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este documento?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Documento excluído"); load(); }
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
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
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
            <Button className="mt-4" onClick={create}><Plus className="mr-2 h-4 w-4" /> Novo documento</Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <div key={d.id} className="group relative overflow-hidden rounded-lg border bg-card transition hover:shadow-md">
                <Link to="/doc/$id" params={{ id: d.id }} className="block">
                  <div className="grid h-36 place-items-center border-b bg-canvas">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="p-4">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => remove(d.id)}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-background/80 opacity-0 transition hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
