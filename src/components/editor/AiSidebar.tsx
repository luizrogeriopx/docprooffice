import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { useServerFn } from "@tanstack/react-start";
import { runAiAction } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, FileText, PenLine, SpellCheck2, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props { editor: Editor | null; }

type Action = "improve" | "summarize" | "continue" | "spelling";

const ACTIONS: { key: Action; label: string; icon: React.ComponentType<any>; needsSelection: boolean; help: string }[] = [
  { key: "improve",   label: "Melhorar texto",     icon: Wand2,       needsSelection: true,  help: "Reescreve o trecho selecionado" },
  { key: "summarize", label: "Resumir",            icon: FileText,    needsSelection: true,  help: "Resume o trecho selecionado" },
  { key: "continue",  label: "Continuar escrevendo", icon: PenLine,   needsSelection: false, help: "Continua a partir do final" },
  { key: "spelling",  label: "Corrigir ortografia", icon: SpellCheck2, needsSelection: true,  help: "Corrige gramática e ortografia" },
];

export function AiSidebar({ editor }: Props) {
  const callAi = useServerFn(runAiAction);
  const [busy, setBusy] = useState<Action | null>(null);
  const [preview, setPreview] = useState<{ action: Action; result: string; from: number; to: number; append: boolean } | null>(null);

  const run = async (action: Action, needsSelection: boolean) => {
    if (!editor) return;
    let text = "";
    let from = editor.state.selection.from;
    let to = editor.state.selection.to;
    const append = action === "continue" || from === to;

    if (append) {
      text = editor.getText().slice(-4000);
      const end = editor.state.doc.content.size;
      from = end; to = end;
    } else {
      if (needsSelection && from === to) {
        toast.message("Selecione um trecho de texto primeiro");
        return;
      }
      text = editor.state.doc.textBetween(from, to, "\n");
    }

    if (!text.trim()) { toast.message("Sem texto para processar"); return; }
    setBusy(action);
    try {
      const { text: result } = await callAi({ data: { action, text } });
      setPreview({ action, result, from, to, append });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao chamar IA");
    } finally {
      setBusy(null);
    }
  };

  const apply = () => {
    if (!editor || !preview) return;
    const chain = editor.chain().focus();
    if (preview.append) {
      chain.insertContentAt(preview.to, "\n" + preview.result).run();
    } else {
      chain.insertContentAt({ from: preview.from, to: preview.to }, preview.result).run();
    }
    setPreview(null);
    toast.success("Aplicado ao documento");
  };

  return (
    <aside className="hidden w-80 shrink-0 border-l bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Assistente de IA</div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-2">
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              onClick={() => run(a.key, a.needsSelection)}
              disabled={busy !== null}
              className="flex w-full items-start gap-3 rounded-md border bg-card p-3 text-left transition hover:bg-accent disabled:opacity-50"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                {busy === a.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <a.icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">{a.help}</div>
              </div>
            </button>
          ))}
        </div>

        {preview && (
          <div className="mt-6 rounded-md border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Sugestão da IA</div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
                <Button size="sm" className="h-7 w-7 p-0" onClick={apply}><Check className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm">{preview.result}</div>
            <Button onClick={apply} size="sm" className="mt-3 w-full">Aplicar ao documento</Button>
          </div>
        )}

        <p className="mt-6 px-1 text-xs text-muted-foreground">
          Dica: selecione um trecho antes de usar Melhorar, Resumir ou Corrigir.
        </p>
      </div>
    </aside>
  );
}
