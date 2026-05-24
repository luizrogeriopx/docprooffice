import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, LogOut, Loader2, Share2, Mail, MessageCircle, HardDrive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewDocumentDialog } from "@/components/dashboard/NewDocumentDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const shareUrlFor = (id: string) => `${window.location.origin}/doc/${id}`;
  const shareText = (title: string, url: string) =>
    `Confira o documento "${title}": ${url}`;

  const shareWhatsApp = (doc: Doc, business = false) => {
    const url = shareUrlFor(doc.id);
    const text = encodeURIComponent(shareText(doc.title, url));
    const target = business
      ? `whatsapp://send?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(target, "_blank");
  };

  const shareEmail = (doc: Doc) => {
    const url = shareUrlFor(doc.id);
    const subject = encodeURIComponent(`Documento: ${doc.title}`);
    const body = encodeURIComponent(shareText(doc.title, url));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const shareDrive = async (doc: Doc) => {
    const url = shareUrlFor(doc.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado. Cole no Google Drive.");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
    window.open("https://drive.google.com/drive/my-drive", "_blank");
  };

  useEffect(() => { if (user) load(); }, [user]);

  const openCreate = () => setDialogOpen(true);

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
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-md bg-background/80 hover:bg-accent"
                        aria-label="Compartilhar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuLabel>Compartilhar</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => shareWhatsApp(d, false)}>
                        <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => shareWhatsApp(d, true)}>
                        <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp Business
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => shareEmail(d)}>
                        <Mail className="mr-2 h-4 w-4" /> E-mail
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => shareDrive(d)}>
                        <HardDrive className="mr-2 h-4 w-4" /> Google Drive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    onClick={() => remove(d.id)}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/80 transition hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Excluir"
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
    </div>
  );
}
