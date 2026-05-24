import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Upload, User, Mail, Receipt, BarChart3, Calculator, Loader2 } from "lucide-react";
import { TEMPLATES, TEMPLATE_TITLES, type TemplateKey } from "@/lib/templates";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
}

type Option = {
  key: "blank" | "upload" | TemplateKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

const OPTIONS: Option[] = [
  { key: "blank", title: "Documento em branco", desc: "Comece do zero", icon: FileText },
  { key: "upload", title: "Upload de documento", desc: "Importe .docx, .html ou .txt", icon: Upload },
  { key: "resume", title: "Currículo", desc: "Modelo pré-pronto", icon: User },
  { key: "letter", title: "Carta", desc: "Modelo pré-pronto", icon: Mail },
  { key: "invoice", title: "Fatura", desc: "Modelo pré-pronto", icon: Receipt },
  { key: "report", title: "Relatório", desc: "Modelo pré-pronto", icon: BarChart3 },
  { key: "budget", title: "Orçamento", desc: "Modelo pré-pronto", icon: Calculator },
];

export function NewDocumentDialog({ open, onOpenChange, userId }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const createDoc = async (title: string, html: string) => {
    const { data, error } = await supabase
      .from("documents")
      .insert({ user_id: userId, title, content_html: html })
      .select("id")
      .single();
    if (error || !data) { toast.error(error?.message ?? "Erro ao criar"); return; }
    onOpenChange(false);
    navigate({ to: "/doc/$id", params: { id: data.id } });
  };

  const handle = async (opt: Option) => {
    if (busy) return;
    if (opt.key === "blank") {
      setBusy(opt.key);
      await createDoc("Documento sem título", "");
      setBusy(null);
      return;
    }
    if (opt.key === "upload") {
      fileRef.current?.click();
      return;
    }
    setBusy(opt.key);
    await createDoc(TEMPLATE_TITLES[opt.key], TEMPLATES[opt.key]);
    setBusy(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("upload");
    try {
      const name = file.name.replace(/\.[^/.]+$/, "") || "Documento importado";
      let html = "";
      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import(/* @vite-ignore */ "mammoth/mammoth.browser" as string);
        const buf = await file.arrayBuffer();
        const res = await (mammoth as any).convertToHtml({ arrayBuffer: buf });
        html = res.value || "";
      } else if (file.name.toLowerCase().endsWith(".html") || file.name.toLowerCase().endsWith(".htm")) {
        html = await file.text();
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        const text = await file.text();
        html = text.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
      } else {
        toast.error("Formato não suportado. Use .docx, .html ou .txt");
        setBusy(null);
        return;
      }
      await createDoc(name, html);
    } catch (err: any) {
      toast.error("Erro ao importar: " + (err?.message ?? "desconhecido"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo documento</DialogTitle>
          <DialogDescription>Escolha como deseja começar</DialogDescription>
        </DialogHeader>
        <input ref={fileRef} type="file" accept=".docx,.html,.htm,.txt" className="hidden" onChange={onFile} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const loading = busy === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handle(opt)}
                disabled={!!busy}
                className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:shadow-md disabled:opacity-50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="font-medium">{opt.title}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
