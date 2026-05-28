import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  User,
  Mail,
  Receipt,
  BarChart3,
  Calculator,
  Loader2,
  Presentation,
  ArrowLeft,
} from "lucide-react";
import { TEMPLATES, TEMPLATE_TITLES, type TemplateKey } from "@/lib/templates";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
}

type Option = {
  key: "blank" | "upload" | "presentation" | TemplateKey;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

const OPTIONS: Option[] = [
  { key: "blank", title: "Documento em branco", desc: "Comece do zero", icon: FileText },
  {
    key: "upload",
    title: "Upload de documento",
    desc: "Importe .docx, .html ou .txt",
    icon: Upload,
  },
  {
    key: "presentation",
    title: "Apresentação",
    desc: "Criar ou importar slides 16:9 Widescreen",
    icon: Presentation,
  },
  { key: "resume", title: "Currículo", desc: "Modelo pré-pronto", icon: User },
  { key: "letter", title: "Carta", desc: "Modelo pré-pronto", icon: Mail },
  { key: "invoice", title: "Fatura", desc: "Modelo pré-pronto", icon: Receipt },
  { key: "report", title: "Relatório", desc: "Modelo pré-pronto", icon: BarChart3 },
  { key: "budget", title: "Orçamento", desc: "Modelo pré-pronto", icon: Calculator },
];

export function NewDocumentDialog({ open, onOpenChange, userId }: Props) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const pptxFileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"main" | "presentation">("main");

  const createDoc = async (
    title: string,
    html: string,
    layout: "document" | "presentation" = "document",
  ) => {
    const initialContent =
      layout === "presentation"
        ? { type: "doc", attrs: { layout: "presentation" }, content: [{ type: "paragraph" }] }
        : { type: "doc", attrs: { layout: "document" }, content: [{ type: "paragraph" }] };

    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        title,
        content_html: html,
        content: initialContent,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao criar");
      return;
    }
    onOpenChange(false);
    navigate({ to: "/doc/$id", params: { id: data.id } });
  };

  const handle = async (opt: Option) => {
    if (busy) return;
    if (opt.key === "presentation") {
      setView("presentation");
      return;
    }
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
      } else if (
        file.name.toLowerCase().endsWith(".html") ||
        file.name.toLowerCase().endsWith(".htm")
      ) {
        html = await file.text();
      } else if (file.name.toLowerCase().endsWith(".txt")) {
        const text = await file.text();
        html = text
          .split(/\n\n+/)
          .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
          .join("");
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

  const onPptxFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("presentation_upload");
    try {
      const name = file.name.replace(/\.[^/.]+$/, "") || "Apresentação importada";
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);

      // Find all slide files
      const slideFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"),
      );

      if (slideFiles.length === 0) {
        toast.error("Nenhum slide encontrado na apresentação.");
        setBusy(null);
        return;
      }

      // Sort slide files numerically
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.replace(/[^\d]/g, ""), 10);
        const numB = parseInt(b.replace(/[^\d]/g, ""), 10);
        return numA - numB;
      });

      const parser = new DOMParser();
      const slidesHtml: string[] = [];

      for (const slidePath of slideFiles) {
        const xmlText = await zip.files[slidePath].async("text");
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        // Extract paragraph lines
        const paragraphs = xmlDoc.getElementsByTagName("a:p");
        const slideLines: string[] = [];

        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          const textEls = p.getElementsByTagName("a:t");
          let pText = "";
          for (let j = 0; j < textEls.length; j++) {
            pText += textEls[j].textContent || "";
          }
          if (pText.trim()) {
            slideLines.push(`<p>${pText.trim()}</p>`);
          }
        }

        if (slideLines.length > 0) {
          slidesHtml.push(slideLines.join(""));
        } else {
          slidesHtml.push("<p></p>");
        }
      }

      // Join slides with a manual page break
      const html = slidesHtml.join('<div data-page-break="true" class="docpro-page-break"></div>');
      await createDoc(name, html, "presentation");
    } catch (err: any) {
      toast.error("Erro ao importar PPTX: " + (err?.message ?? "desconhecido"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val) setView("main");
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {view === "presentation" ? "Nova Apresentação" : "Novo documento"}
          </DialogTitle>
          <DialogDescription>
            {view === "presentation"
              ? "Escolha como criar seus slides"
              : "Escolha como deseja começar"}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".docx,.html,.htm,.txt"
          className="hidden"
          onChange={onFile}
        />
        <input
          ref={pptxFileRef}
          type="file"
          accept=".pptx"
          className="hidden"
          onChange={onPptxFile}
        />

        {view === "main" ? (
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
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="font-medium">{opt.title}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!!busy}
                onClick={async () => {
                  setBusy("presentation_blank");
                  await createDoc("Apresentação sem título", "", "presentation");
                  setBusy(null);
                }}
                className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-6 text-left transition hover:border-primary hover:shadow-md disabled:opacity-50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  {busy === "presentation_blank" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="font-medium">Nova Apresentação</div>
                <div className="text-xs text-muted-foreground">
                  Comece a criar slides do zero na proporção 16:9 Widescreen
                </div>
              </button>

              <button
                disabled={!!busy}
                onClick={() => pptxFileRef.current?.click()}
                className="group flex flex-col items-start gap-2 rounded-lg border bg-card p-6 text-left transition hover:border-primary hover:shadow-md disabled:opacity-50"
              >
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  {busy === "presentation_upload" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>
                <div className="font-medium">Upload de Existente</div>
                <div className="text-xs text-muted-foreground">
                  Importe uma apresentação existente (.pptx)
                </div>
              </button>
            </div>

            <button
              onClick={() => setView("main")}
              disabled={!!busy}
              className="flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para as opções de documento
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
