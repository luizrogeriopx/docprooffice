import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Plus, Search, Trash2, LogOut, Loader2, Share2, Mail, MessageCircle, HardDrive, Briefcase } from "lucide-react";
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
                <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); shareWhatsApp(d, false); }}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/90 shadow-sm hover:bg-accent"
                    aria-label="Compartilhar no WhatsApp"
                    title="WhatsApp"
                  >
                    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
                      <path fill="#25D366" d="M16 .4C7.4.4.5 7.3.5 15.9c0 2.8.7 5.4 2.1 7.8L.4 31.6l8.1-2.1c2.3 1.2 4.8 1.9 7.5 1.9 8.6 0 15.5-6.9 15.5-15.5S24.6.4 16 .4z"/>
                      <path fill="#fff" d="M23.5 19.7c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.3 1.6-.2.3-.5.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.2-2.7-.2-.4 0-.6.2-.8.2-.2.4-.5.5-.7.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7-.1-.2-.9-2.2-1.2-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4 0 2 1.5 3.9 1.7 4.2.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9.8.3 1.5.2 2.1.1.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.4-.2-.8-.4z"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); shareWhatsApp(d, true); }}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/90 shadow-sm hover:bg-accent"
                    aria-label="Compartilhar no WhatsApp Business"
                    title="WhatsApp Business"
                  >
                    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
                      <path fill="#075E54" d="M16 .4C7.4.4.5 7.3.5 15.9c0 2.8.7 5.4 2.1 7.8L.4 31.6l8.1-2.1c2.3 1.2 4.8 1.9 7.5 1.9 8.6 0 15.5-6.9 15.5-15.5S24.6.4 16 .4z"/>
                      <path fill="#fff" d="M23.5 19.7c-.4-.2-2.3-1.1-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.3 1.6-.2.3-.5.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.3-2.2-2.7-.2-.4 0-.6.2-.8.2-.2.4-.5.5-.7.2-.2.2-.4.4-.6.1-.2.1-.5 0-.7-.1-.2-.9-2.2-1.2-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4 0 2 1.5 3.9 1.7 4.2.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9.8.3 1.5.2 2.1.1.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.4-.2-.8-.4z"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); shareEmail(d); }}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/90 shadow-sm hover:bg-accent"
                    aria-label="Compartilhar por e-mail"
                    title="E-mail"
                  >
                    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
                      <path fill="#EA4335" d="M16 18.5L2 8.4V8c0-1.1.9-2 2-2h24c1.1 0 2 .9 2 2v.4L16 18.5z"/>
                      <path fill="#FBBC04" d="M2 8.4l14 10.1L30 8.4V24c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V8.4z"/>
                      <path fill="#34A853" d="M16 18.5L30 8.4V24c0 1.1-.9 2-2 2H16V18.5z"/>
                      <path fill="#4285F4" d="M16 18.5L2 8.4V24c0 1.1.9 2 2 2h12V18.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); shareDrive(d); }}
                    className="grid h-8 w-8 place-items-center rounded-md bg-background/90 shadow-sm hover:bg-accent"
                    aria-label="Compartilhar no Google Drive"
                    title="Google Drive"
                  >
                    <svg viewBox="0 0 32 32" className="h-4 w-4" aria-hidden="true">
                      <path fill="#0066DA" d="M2.7 23.6l1.6 2.7c.3.6.8 1 1.4 1.3L11.4 18H0c0 .7.2 1.4.5 2l2.2 3.6z"/>
                      <path fill="#00AC47" d="M16 10L10.3 0 4.6 10c-.3.6-.5 1.3-.5 2h11.4l.5-2z"/>
                      <path fill="#EA4335" d="M26 27.6c.6-.3 1.1-.8 1.4-1.3l.7-1.1 3.1-5.2c.3-.6.5-1.3.5-2H20.3l2.4 4.7 3.3 4.9z"/>
                      <path fill="#00832D" d="M16 10L21.7 0H10.3L4.6 10z"/>
                      <path fill="#2684FC" d="M20.3 18l-4.3-8H4.1L11.4 18z"/>
                      <path fill="#FFBA00" d="M26 27.6L20.3 18h11.4c0 .7-.2 1.4-.5 2l-3.1 5.2-.7 1.1c-.3.5-.8 1-1.4 1.3z"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(d.id); }}
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
    </div>
  );
}
