import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle, Home, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/thanks")({
  component: ThanksPage,
  head: () => ({ meta: [{ title: "Obrigado por participar — DocPro" }] }),
});

function ThanksPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-4 py-12">
      {/* Decorative premium background elements */}
      <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      {/* Main Card */}
      <div className="relative w-full max-w-md scale-95 transform overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-lg transition-all duration-500 hover:shadow-xl sm:scale-100">
        {/* Animated Checkmark Container */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5 animate-pulse">
          <CheckCircle className="h-12 w-12" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Obrigado por participar!
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-base text-muted-foreground">
          Seu documento foi baixado com sucesso.
        </p>
        <p className="mt-2 text-lg font-semibold text-primary">
          Até a próxima!
        </p>

        {/* Divider */}
        <div className="my-8 h-[1px] w-full bg-border" />

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/95 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Home className="h-4 w-4" />
            Ir para o Dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
