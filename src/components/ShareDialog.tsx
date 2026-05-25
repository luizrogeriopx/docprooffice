import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2, Eye, Copy as CopyIcon, Users, MessageCircle, Mail, HardDrive } from "lucide-react";

type Mode = "view" | "fork" | "collab";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  documentTitle: string;
}

interface Collaborator { user_id: string; email: string | null; full_name: string | null; }

function genToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

export function ShareDialog({ open, onOpenChange, documentId, documentTitle }: Props) {
  const [tokens, setTokens] = useState<Record<Mode, string | null>>({ view: null, fork: null, collab: null });
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("share_links")
      .select("mode, token")
      .eq("document_id", documentId);
    const map: Record<Mode, string | null> = { view: null, fork: null, collab: null };
    data?.forEach((r) => { map[r.mode as Mode] = r.token; });
    setTokens(map);
    const { data: c } = await supabase.rpc("list_collaborators", { _doc: documentId });
    if (c) setCollabs(c as Collaborator[]);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, documentId]);

  const generate = async (mode: Mode) => {
    setLoading(true);
    const token = genToken();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    // delete previous if any
    await supabase.from("share_links").delete().eq("document_id", documentId).eq("mode", mode);
    const { error } = await supabase.from("share_links").insert({
      document_id: documentId, owner_id: user.id, mode, token,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setTokens((t) => ({ ...t, [mode]: token }));
    toast.success("Link gerado");
  };

  const revoke = async (mode: Mode) => {
    await supabase.from("share_links").delete().eq("document_id", documentId).eq("mode", mode);
    setTokens((t) => ({ ...t, [mode]: null }));
    toast.success("Link removido");
  };

  const removeCollab = async (userId: string) => {
    const { error } = await supabase.from("document_collaborators")
      .delete().eq("document_id", documentId).eq("user_id", userId);
    if (error) toast.error(error.message);
    else { toast.success("Colaborador removido"); load(); }
  };

  const url = (t: string) => `${window.location.origin}/share/${t}`;
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(url(t)); toast.success("Link copiado"); }
    catch { toast.error("Falha ao copiar"); }
  };

  const shareText = (t: string) => encodeURIComponent(`Documento "${documentTitle}": ${url(t)}`);
  const wpp = (t: string) => window.open(`https://wa.me/?text=${shareText(t)}`, "_blank");
  const email = (t: string) => { window.location.href = `mailto:?subject=${encodeURIComponent(documentTitle)}&body=${shareText(t)}`; };
  const drive = async (t: string) => {
    try { await navigator.clipboard.writeText(url(t)); toast.success("Link copiado. Cole no Drive."); } catch {}
    window.open("https://drive.google.com/drive/my-drive", "_blank");
  };

  const Section = ({ mode, title, desc }: { mode: Mode; title: string; desc: string }) => {
    const tk = tokens[mode];
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{desc}</p>
        {tk ? (
          <>
            <div className="flex gap-2">
              <Input readOnly value={url(tk)} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(tk)}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => generate(mode)} title="Gerar novo"><RefreshCw className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => revoke(mode)} title="Remover link"><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => wpp(tk)}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button>
              <Button variant="outline" size="sm" onClick={() => email(tk)}><Mail className="mr-2 h-4 w-4" />E-mail</Button>
              <Button variant="outline" size="sm" onClick={() => drive(tk)}><HardDrive className="mr-2 h-4 w-4" />Drive</Button>
            </div>
          </>
        ) : (
          <Button onClick={() => generate(mode)} disabled={loading}>Gerar link de {title.toLowerCase()}</Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compartilhar documento</DialogTitle>
          <DialogDescription>Escolha o tipo de acesso que quer dar.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="view" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="view"><Eye className="mr-2 h-4 w-4" />Visualizar</TabsTrigger>
            <TabsTrigger value="fork"><CopyIcon className="mr-2 h-4 w-4" />Duplicar</TabsTrigger>
            <TabsTrigger value="collab"><Users className="mr-2 h-4 w-4" />Colaborar</TabsTrigger>
          </TabsList>
          <TabsContent value="view" className="mt-4">
            <Section mode="view" title="visualização" desc="Quem abrir só poderá ler o documento. Não precisa de login." />
          </TabsContent>
          <TabsContent value="fork" className="mt-4">
            <Section mode="fork" title="duplicação" desc="Quem abrir (logado) ganha uma cópia independente na própria conta. O seu documento não é alterado." />
          </TabsContent>
          <TabsContent value="collab" className="mt-4 space-y-4">
            <Section mode="collab" title="colaboração" desc="Quem abrir (logado) vira colaborador e edita o mesmo documento que você. As alterações aparecem em todas as contas." />
            {collabs.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium">Colaboradores</div>
                <ul className="divide-y rounded-md border">
                  {collabs.map((c) => (
                    <li key={c.user_id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="truncate">{c.full_name || c.email || c.user_id}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeCollab(c.user_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
