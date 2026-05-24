import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  PageNumberFormat,
  PageNumberPosition,
  PageSettings,
} from "./pageSettings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PageSettings;
  onChange: (value: PageSettings) => void;
}

const POSITIONS: { value: PageNumberPosition; label: string }[] = [
  { value: "bottom-left", label: "Rodapé · esquerda" },
  { value: "bottom-center", label: "Rodapé · centro" },
  { value: "bottom-right", label: "Rodapé · direita" },
];

const FORMATS: { value: PageNumberFormat; label: string }[] = [
  { value: "n", label: "1" },
  { value: "page-n", label: "Página 1" },
  { value: "page-n-of-total", label: "Página 1 de N" },
  { value: "dash-n-dash", label: "— 1 —" },
];

export function PageSettingsDialog({ open, onOpenChange, value, onChange }: Props) {
  const [local, setLocal] = useState<PageSettings>(value);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (open && local !== value && JSON.stringify(local) !== JSON.stringify(value)) {
    // no-op — keep current draft. Reset only when closed.
  }

  const reset = () => setLocal(value);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Faça login para enviar imagens");
        return;
      }
      const path = `${u.user.id}/watermark-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("doc-images").upload(path, file);
      if (error) {
        toast.error(error.message);
        return;
      }
      const { data } = supabase.storage.from("doc-images").getPublicUrl(path);
      setLocal((s) => ({
        ...s,
        watermark: { ...s.watermark, imageUrl: data.publicUrl, enabled: true },
      }));
      toast.success("Marca d'água enviada");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações da página</DialogTitle>
          <DialogDescription>
            Rodapé, numeração e marca d'água aparecem em todas as páginas.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Rodapé</Label>
              <Switch
                checked={local.footer.enabled}
                onCheckedChange={(checked) =>
                  setLocal((s) => ({ ...s, footer: { ...s.footer, enabled: checked } }))
                }
              />
            </div>
            <Input
              placeholder="Ex.: Confidencial · Empresa XYZ"
              value={local.footer.text}
              disabled={!local.footer.enabled}
              onChange={(e) =>
                setLocal((s) => ({ ...s, footer: { ...s.footer, text: e.target.value } }))
              }
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Numeração de páginas</Label>
              <Switch
                checked={local.pageNumber.enabled}
                onCheckedChange={(checked) =>
                  setLocal((s) => ({
                    ...s,
                    pageNumber: { ...s.pageNumber, enabled: checked },
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Modelo</Label>
                <Select
                  value={local.pageNumber.format}
                  disabled={!local.pageNumber.enabled}
                  onValueChange={(v) =>
                    setLocal((s) => ({
                      ...s,
                      pageNumber: { ...s.pageNumber, format: v as PageNumberFormat },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Posição</Label>
                <Select
                  value={local.pageNumber.position}
                  disabled={!local.pageNumber.enabled}
                  onValueChange={(v) =>
                    setLocal((s) => ({
                      ...s,
                      pageNumber: { ...s.pageNumber, position: v as PageNumberPosition },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Marca d'água</Label>
              <Switch
                checked={local.watermark.enabled}
                onCheckedChange={(checked) =>
                  setLocal((s) => ({
                    ...s,
                    watermark: { ...s.watermark, enabled: checked },
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded border bg-muted">
                {local.watermark.imageUrl ? (
                  <img
                    src={local.watermark.imageUrl}
                    alt="Marca d'água"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Enviar imagem
                    </>
                  )}
                </Button>
                {local.watermark.imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setLocal((s) => ({
                        ...s,
                        watermark: { ...s.watermark, imageUrl: "" },
                      }))
                    }
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" /> Remover
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Transparência</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(local.watermark.opacity * 100)}%
                </span>
              </div>
              <Slider
                min={5}
                max={100}
                step={1}
                disabled={!local.watermark.enabled}
                value={[Math.round(local.watermark.opacity * 100)]}
                onValueChange={([v]) =>
                  setLocal((s) => ({
                    ...s,
                    watermark: { ...s.watermark, opacity: v / 100 },
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Tamanho</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(local.watermark.scale * 100)}%
                </span>
              </div>
              <Slider
                min={20}
                max={100}
                step={1}
                disabled={!local.watermark.enabled}
                value={[Math.round(local.watermark.scale * 100)]}
                onValueChange={([v]) =>
                  setLocal((s) => ({
                    ...s,
                    watermark: { ...s.watermark, scale: v / 100 },
                  }))
                }
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onChange(local);
              onOpenChange(false);
              toast.success("Configurações da página atualizadas");
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
