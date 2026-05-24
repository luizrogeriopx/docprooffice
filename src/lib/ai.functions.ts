import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ActionSchema = z.object({
  action: z.enum(["improve", "summarize", "continue", "spelling"]),
  text: z.string().min(1).max(20000),
});

const PROMPTS: Record<string, string> = {
  improve: "Você é um editor profissional. Reescreva o texto a seguir melhorando clareza, fluidez e impacto, mantendo o idioma original. Responda APENAS com o texto reescrito, sem explicações.",
  summarize: "Resuma o texto a seguir em poucos parágrafos claros, no idioma original. Responda APENAS com o resumo, sem explicações.",
  continue: "Continue escrevendo o texto a seguir naturalmente, mantendo o tom, estilo e idioma. Responda APENAS com a continuação (sem repetir o texto original).",
  spelling: "Corrija ortografia, gramática e pontuação do texto a seguir, preservando o significado e o idioma. Responda APENAS com o texto corrigido.",
};

async function callGateway(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Limite de uso atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace Lovable.");
    throw new Error(`Erro da IA: ${res.status}`);
  }
  return res.json();
}

export const runAiAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActionSchema.parse(d))
  .handler(async ({ data }) => {
    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: PROMPTS[data.action] },
        { role: "user", content: data.text },
      ],
    });
    const text: string = json.choices?.[0]?.message?.content ?? "";
    return { text };
  });

const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8000),
  })).min(1).max(40),
  docText: z.string().max(20000).optional().default(""),
  selectionText: z.string().max(10000).optional().default(""),
});

const CHAT_SYSTEM = `Você é o DocPro Copilot, um assistente integrado a um editor de documentos.
Ajude o usuário a redigir, revisar, reestruturar, traduzir ou gerar conteúdo para o documento aberto.
Responda sempre em português (a menos que o usuário escreva em outro idioma).

Você DEVE responder com um objeto JSON válido com esta forma exata:
{
  "reply": "explicação curta para o usuário (1-3 frases)",
  "action": "append" | "replace_selection" | "none",
  "html": "HTML pronto para inserir no documento, ou string vazia se action='none'"
}

Regras para o HTML:
- Use apenas tags semânticas: <h1>..<h6>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <u>, <a>, <table>/<tr>/<th>/<td>, <blockquote>, <br/>.
- NÃO inclua <html>, <body>, <style>, scripts ou atributos de classe.
- Quando o usuário tiver uma seleção e pedir para alterar/reescrever/traduzir/corrigir esse trecho, use action="replace_selection".
- Quando o usuário pedir para criar/adicionar/gerar/continuar conteúdo novo, use action="append".
- Para perguntas, explicações ou conversa, use action="none" e html="".
- "reply" nunca deve conter o documento inteiro — coloque o conteúdo gerado em "html".`;

export const runAiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatSchema.parse(d))
  .handler(async ({ data }) => {
    const contextParts: string[] = [];
    if (data.selectionText.trim()) {
      contextParts.push(`Trecho atualmente selecionado pelo usuário:\n"""${data.selectionText}"""`);
    }
    if (data.docText.trim()) {
      contextParts.push(`Conteúdo atual do documento (pode estar truncado):\n"""${data.docText.slice(0, 12000)}"""`);
    }
    const systemMsg = contextParts.length
      ? `${CHAT_SYSTEM}\n\n${contextParts.join("\n\n")}`
      : CHAT_SYSTEM;

    const json = await callGateway({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMsg },
        ...data.messages,
      ],
    });

    const raw: string = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { reply: string; action: "append" | "replace_selection" | "none"; html: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw || "Não consegui processar a resposta.", action: "none", html: "" };
    }
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : "",
      action: (["append", "replace_selection", "none"] as const).includes(parsed.action) ? parsed.action : "none",
      html: typeof parsed.html === "string" ? parsed.html : "",
    };
  });
