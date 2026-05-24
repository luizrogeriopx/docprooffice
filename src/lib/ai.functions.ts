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

export const runAiAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ActionSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: PROMPTS[data.action] },
          { role: "user", content: data.text },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de uso atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace Lovable.");
      throw new Error(`Erro da IA: ${res.status}`);
    }
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    return { text };
  });
