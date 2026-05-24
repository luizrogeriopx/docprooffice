import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Save, Download, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "DocPro — Editor de documentos com IA" },
      { name: "description", content: "Crie, edite e exporte documentos profissionais com IA integrada. Auto save, PDF, DOCX e muito mais." },
    ],
  }),
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </div>
            DocPro
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/login"><Button size="sm">Começar grátis</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-accent px-3 py-1 text-xs text-accent-foreground">
          <Sparkles className="h-3 w-3" /> Com inteligência artificial integrada
        </div>
        <h1 className="text-balance text-5xl font-bold tracking-tight md:text-6xl">
          O editor de documentos<br />que pensa com você.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          DocPro é um editor moderno inspirado no Word e no Google Docs, com IA, auto save em tempo real e exportação para PDF e DOCX.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/login"><Button size="lg">Criar conta gratuita</Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Já tenho conta</Button></Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 md:grid-cols-3">
        {[
          { i: Sparkles, t: "IA integrada", d: "Melhore, resuma, corrija e continue textos com um clique." },
          { i: Save, t: "Auto save", d: "Suas alterações são salvas automaticamente em tempo real." },
          { i: Download, t: "Exportação", d: "Baixe seus documentos como PDF ou DOCX." },
          { i: FileText, t: "Editor rich text", d: "Negrito, itálico, listas, tabelas, imagens e muito mais." },
          { i: ShieldCheck, t: "Privado e seguro", d: "Cada documento pertence apenas a você." },
          { i: Zap, t: "Atalhos do teclado", d: "Fluxo profissional inspirado no Word e Google Docs." },
        ].map(({ i: Icon, t, d }) => (
          <div key={t} className="rounded-lg border bg-card p-5">
            <Icon className="h-5 w-5 text-primary" />
            <div className="mt-3 font-semibold">{t}</div>
            <div className="mt-1 text-sm text-muted-foreground">{d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
