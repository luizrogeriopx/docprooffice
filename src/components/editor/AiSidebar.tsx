import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useServerFn } from "@tanstack/react-start";
import { runAiAction, runAiChat } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Wand2, FileText, PenLine, SpellCheck2, Loader2, Check, X,
  Send, Plus, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { editor: Editor | null; }

type Action = "improve" | "summarize" | "continue" | "spelling";

const ACTIONS: { key: Action; label: string; icon: React.ComponentType<any>; needsSelection: boolean }[] = [
  { key: "improve",   label: "Melhorar",   icon: Wand2,       needsSelection: true  },
  { key: "summarize", label: "Resumir",    icon: FileText,    needsSelection: true  },
  { key: "continue",  label: "Continuar",  icon: PenLine,     needsSelection: false },
  { key: "spelling",  label: "Corrigir",   icon: SpellCheck2, needsSelection: true  },
];

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  action?: "append" | "replace_selection" | "none";
  html?: string;
  applied?: boolean;
  selectionRange?: { from: number; to: number };
};

export function AiSidebar({ editor }: Props) {
  const callAi = useServerFn(runAiAction);
  const chatFn = useServerFn(runAiChat);
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [preview, setPreview] = useState<{ action: Action; result: string; from: number; to: number; append: boolean } | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Olá! Eu sou o Assistente. Posso escrever, reescrever, traduzir, resumir ou responder dúvidas sobre o documento. Selecione um trecho ou peça algo novo." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // ---------- Quick action shortcuts ----------
  const runAction = async (action: Action, needsSelection: boolean) => {
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
      if (needsSelection && from === to) { toast.message("Selecione um trecho primeiro"); return; }
      text = editor.state.doc.textBetween(from, to, "\n");
    }
    if (!text.trim()) { toast.message("Sem texto para processar"); return; }
    setBusyAction(action);
    try {
      const { text: result } = await callAi({ data: { action, text } });
      setPreview({ action, result, from, to, append });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao chamar IA");
    } finally {
      setBusyAction(null);
    }
  };

  const applyPreview = () => {
    if (!editor || !preview) return;
    const chain = editor.chain().focus();
    if (preview.append) chain.insertContentAt(preview.to, "\n" + preview.result).run();
    else chain.insertContentAt({ from: preview.from, to: preview.to }, preview.result).run();
    setPreview(null);
    toast.success("Aplicado ao documento");
  };

  // ---------- Chat ----------
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !editor) return;

    const from = editor.state.selection.from;
    const to = editor.state.selection.to;
    const hasSelection = from !== to;
    const selectionText = hasSelection ? editor.state.doc.textBetween(from, to, "\n") : "";
    const docText = editor.getText();

    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await chatFn({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          docText,
          selectionText,
        },
      });
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: res.reply || (res.html ? "Pronto, posso inserir isso no documento." : ""),
        action: res.action,
        html: res.html,
        selectionRange: hasSelection ? { from, to } : undefined,
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Erro: ${e.message ?? "falha ao processar"}` }]);
    } finally {
      setSending(false);
    }
  };

  const applyChatInsertion = (idx: number) => {
    if (!editor) return;
    setMessages((msgs) => {
      const msg = msgs[idx];
      if (!msg || !msg.html || msg.action === "none") return msgs;
      const chain = editor.chain().focus();
      if (msg.action === "replace_selection" && msg.selectionRange) {
        chain.insertContentAt(msg.selectionRange, msg.html).run();
      } else {
        const end = editor.state.doc.content.size;
        chain.insertContentAt(end, msg.html).run();
      }
      toast.success("Inserido no documento");
      const copy = msgs.slice();
      copy[idx] = { ...msg, applied: true };
      return copy;
    });
  };

  const newChat = () => {
    setMessages([{ role: "assistant", content: "Nova conversa iniciada. Como posso ajudar com este documento?" }]);
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <aside className="hidden w-80 shrink-0 border-l bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">Assistente</div>
        <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0" onClick={newChat} title="Nova conversa">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-1.5 border-b p-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => runAction(a.key, a.needsSelection)}
            disabled={busyAction !== null}
            className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
          >
            {busyAction === a.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5 text-primary" />}
            {a.label}
          </button>
        ))}
      </div>

      {preview && (
        <div className="border-b bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Sugestão</div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
              <Button size="sm" className="h-7 w-7 p-0" onClick={applyPreview}><Check className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="max-h-40 overflow-auto whitespace-pre-wrap text-sm">{preview.result}</div>
        </div>
      )}

      {/* Chat messages */}
      <div ref={listRef} className="flex-1 overflow-auto p-3">
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card"
              )}>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                {m.role === "assistant" && m.html && m.action !== "none" && (
                  <div className="mt-2 space-y-2">
                    <div
                      className="max-h-44 overflow-auto rounded border bg-background p-2 text-xs text-foreground"
                      dangerouslySetInnerHTML={{ __html: m.html }}
                    />
                    {m.applied ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3 w-3" /> Inserido</div>
                    ) : (
                      <Button size="sm" className="h-7 w-full text-xs" onClick={() => applyChatInsertion(i)}>
                        {m.action === "replace_selection" ? "Substituir seleção" : "Inserir no documento"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> Pensando...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t p-2">
        <div className="flex items-end gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Peça algo ao Assistente..."
            rows={2}
            className="min-h-[44px] resize-none text-sm"
          />
          <Button size="sm" className="h-10 w-10 shrink-0 p-0" onClick={sendMessage} disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-1.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          <MessageSquare className="h-3 w-3" /> Enter envia · Shift+Enter quebra linha
        </div>
      </div>
    </aside>
  );
}
