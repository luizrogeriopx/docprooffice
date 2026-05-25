import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/share/$token")({
  component: SharePage,
  head: () => ({ meta: [{ title: "Abrindo documento — DocPro" }] }),
});

function SharePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const processedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (processedTokenRef.current === token) return;
    processedTokenRef.current = token;

    (async () => {
      const { data, error } = await supabase.rpc("get_share_link", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        processedTokenRef.current = null;
        toast.error("Link inválido ou expirado");
        navigate({ to: "/" });
        return;
      }
      const mode = row.mode as "view" | "fork" | "collab";
      const docId = row.document_id as string;

      if (mode === "view") {
        navigate({ to: "/doc/$id", params: { id: docId } });
        return;
      }

      if (!user) {
        // store target and bounce to login
        try { sessionStorage.setItem("postLoginRedirect", `/share/${token}`); } catch {}
        navigate({ to: "/login" });
        return;
      }

      if (mode === "fork") {
        const { data: newId, error: e } = await supabase.rpc("fork_document", { _token: token });
        if (e || !newId) { processedTokenRef.current = null; toast.error("Falha ao duplicar"); navigate({ to: "/dashboard" }); return; }
        toast.success("Cópia criada na sua conta");
        navigate({ to: "/doc/$id", params: { id: newId as string } });
      } else if (mode === "collab") {
        const { data: did, error: e } = await supabase.rpc("accept_collab_invite", { _token: token });
        if (e) { processedTokenRef.current = null; toast.error(e.message); navigate({ to: "/dashboard" }); return; }
        toast.success("Você agora é colaborador");
        navigate({ to: "/doc/$id", params: { id: (did as string) || docId } });
      }
    })();
  }, [token, user, loading, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
