import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Download,
  FileText,
  BookMarked,
  FilePlus,
  Settings2,
  Check as CheckIcon,
  Baseline,
  Highlighter,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { exportToPdf, exportToDocx } from "@/lib/export";

interface Props {
  editor: Editor | null;
  title: string;
  abntMode?: string;
  onAbntChange?: (mode: string) => void;
  onOpenPageSettings?: () => void;
}

const ABNT_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "", label: "Sem formatação", desc: "Remove formatação ABNT" },
  {
    value: "abnt",
    label: "ABNT — Times New Roman",
    desc: "Trabalho acadêmico padrão (fonte Times, 12pt, espaço 1,5, margens 3/2/2/3 cm)",
  },
  {
    value: "abnt abnt-arial",
    label: "ABNT — Arial",
    desc: "Trabalho acadêmico (fonte Arial, 12pt, espaço 1,5)",
  },
  {
    value: "abnt abnt-references",
    label: "ABNT — Referências",
    desc: "Alinhamento à esquerda, espaço simples, sem recuo",
  },
  { value: "abnt abnt-cover", label: "ABNT — Capa", desc: "Tudo centralizado e em maiúsculas" },
];

const Btn = ({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) => (
  <Button
    type="button"
    size="sm"
    variant={active ? "secondary" : "ghost"}
    onClick={onClick}
    title={label}
    aria-label={label}
    className="h-8 w-8 p-0"
  >
    {children}
  </Button>
);

const FONT_SIZES = [
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "16",
  "18",
  "20",
  "24",
  "28",
  "32",
  "36",
  "48",
  "60",
  "72",
];

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
  "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79",
];

const HIGHLIGHT_COLORS = [
  "#ffff00", "#00ff00", "#00ffff", "#ff00ff", "#0000ff", "#ff0000",
  "#000080", "#008080", "#008000", "#800080", "#800000", "#808000",
  "#c0c0c0", "#808080", "#000000", "#ffffff", "#ffe599", "#fce5cd",
];

function ColorPalette({
  colors,
  onSelect,
  onClear,
  clearLabel,
  current,
}: {
  colors: string[];
  onSelect: (color: string) => void;
  onClear: () => void;
  clearLabel: string;
  current?: string;
}) {
  return (
    <div className="w-[228px] space-y-2">
      <button
        type="button"
        onClick={onClear}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-left text-xs hover:bg-accent"
      >
        {clearLabel}
      </button>
      <div className="grid grid-cols-10 gap-1">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            title={c}
            className={`h-5 w-5 rounded-sm border ${current?.toLowerCase() === c.toLowerCase() ? "ring-2 ring-primary ring-offset-1" : ""}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <label className="text-xs text-muted-foreground">Personalizada</label>
        <input
          type="color"
          onChange={(e) => onSelect(e.target.value)}
          className="h-6 w-10 cursor-pointer rounded border bg-transparent p-0"
        />
      </div>
    </div>
  );
}

export function EditorToolbar({ editor, title, abntMode = "", onAbntChange, onOpenPageSettings }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentFontSize, setCurrentFontSize] = useState("12");

  // Keep the selector synchronized with the text under the caret/click.
  useEffect(() => {
    if (!editor) return;

    const normalizeSize = (value?: unknown) => {
      if (typeof value !== "string" || !value.trim()) return null;
      const raw = value.trim();
      const numeric = parseFloat(raw);
      if (!isFinite(numeric)) return null;
      if (raw.endsWith("px")) return String(Math.round((numeric * 72) / 96));
      return String(Math.round(numeric));
    };

    let frame: number | null = null;
    const compute = () => {
      try {
        const markedSize = normalizeSize(editor.getAttributes("textStyle").fontSize);
        if (markedSize) {
          setCurrentFontSize(markedSize);
          return;
        }

        const textStyleMark = (
          editor.state.storedMarks ?? editor.state.selection.$from.marks()
        ).find((mark) => mark.type.name === "textStyle");
        const activeMarkSize = normalizeSize(textStyleMark?.attrs.fontSize);
        if (activeMarkSize) {
          setCurrentFontSize(activeMarkSize);
          return;
        }

        const pos = Math.max(
          0,
          Math.min(editor.state.selection.from, editor.state.doc.content.size),
        );
        const domAtPos = editor.view.domAtPos(pos);
        let node: Node | null = domAtPos.node;

        if (node.nodeType === Node.TEXT_NODE) {
          node = node.parentNode;
        } else if (node instanceof HTMLElement) {
          const nearby =
            node.childNodes[Math.max(0, domAtPos.offset - 1)] ?? node.childNodes[domAtPos.offset];
          if (nearby?.nodeType === Node.TEXT_NODE) node = nearby.parentNode;
          else if (nearby instanceof HTMLElement) node = nearby;
        }

        if (!(node instanceof HTMLElement)) {
          const coords = editor.view.coordsAtPos(pos);
          const element = document.elementFromPoint(coords.left, coords.top);
          if (element instanceof HTMLElement && editor.view.dom.contains(element)) node = element;
        }

        if (node instanceof HTMLElement) {
          const renderedSize = normalizeSize(window.getComputedStyle(node).fontSize);
          if (renderedSize) setCurrentFontSize(renderedSize);
        }
      } catch {
        /* noop */
      }
    };

    const scheduleCompute = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compute);
    };

    compute();
    editor.on("selectionUpdate", scheduleCompute);
    editor.on("transaction", scheduleCompute);
    editor.on("focus", scheduleCompute);
    editor.on("update", scheduleCompute);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      editor.off("selectionUpdate", scheduleCompute);
      editor.off("transaction", scheduleCompute);
      editor.off("focus", scheduleCompute);
      editor.off("update", scheduleCompute);
    };
  }, [editor]);

  if (!editor) return null;

  const visibleFontSizes = FONT_SIZES.includes(currentFontSize)
    ? FONT_SIZES
    : [...FONT_SIZES, currentFontSize].sort((a, b) => Number(a) - Number(b));

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL do link", previous ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImageUrl = () => {
    const url = window.prompt("URL da imagem");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const uploadImage = async (file: File) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const path = `${u.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("doc-images").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("doc-images").getPublicUrl(path);
    editor.chain().focus().setImage({ src: data.publicUrl }).run();
    toast.success("Imagem enviada");
  };

  return (
    <div className="sticky top-12 z-10 flex flex-wrap items-center gap-1 border-b bg-toolbar px-3 py-1.5 text-toolbar-foreground">
      <Btn label="Desfazer" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </Btn>
      <Btn label="Refazer" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </Btn>
      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select
        value={currentFontSize}
        onValueChange={(v) => {
          editor.chain().focus().setFontSize(`${v}pt`).run();
        }}
      >
        <SelectTrigger className="h-8 w-[80px]" title="Tamanho do texto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {visibleFontSizes.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn
        label="Negrito (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn
        label="Itálico (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn
        label="Sublinhado (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Btn>
      <Btn
        label="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Btn>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="relative h-8 w-8 p-0"
            title="Cor do texto"
            aria-label="Cor do texto"
          >
            <Baseline className="h-4 w-4" />
            <span
              className="absolute bottom-1 left-1.5 right-1.5 h-1 rounded-sm border border-border/40"
              style={{ backgroundColor: (editor.getAttributes("textStyle").color as string) || "#000000" }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <ColorPalette
            colors={TEXT_COLORS}
            current={editor.getAttributes("textStyle").color as string | undefined}
            onSelect={(c) => editor.chain().focus().setColor(c).run()}
            onClear={() => editor.chain().focus().unsetColor().run()}
            clearLabel="Automático"
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="relative h-8 w-8 p-0"
            title="Cor do realce"
            aria-label="Cor do realce"
          >
            <Highlighter className="h-4 w-4" />
            <span
              className="absolute bottom-1 left-1.5 right-1.5 h-1 rounded-sm border border-border/40"
              style={{ backgroundColor: (editor.getAttributes("highlight").color as string) || "#ffff00" }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <ColorPalette
            colors={HIGHLIGHT_COLORS}
            current={editor.getAttributes("highlight").color as string | undefined}
            onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
            onClear={() => editor.chain().focus().unsetHighlight().run()}
            clearLabel="Sem realce"
          />
        </PopoverContent>
      </Popover>


      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn
        label="Alinhar à esquerda"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </Btn>
      <Btn
        label="Centralizar"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </Btn>
      <Btn
        label="Alinhar à direita"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </Btn>
      <Btn
        label="Justificar"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      >
        <AlignJustify className="h-4 w-4" />
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn
        label="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Btn>
      <Btn
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Btn
        label="Citação"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn label="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="h-4 w-4" />
      </Btn>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" title="Imagem">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            Enviar do computador
          </DropdownMenuItem>
          <DropdownMenuItem onClick={insertImageUrl}>Inserir por URL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadImage(f);
          e.currentTarget.value = "";
        }}
      />
      <Btn
        label="Tabela"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <TableIcon className="h-4 w-4" />
      </Btn>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 px-2"
        title="Nova página (quebra A4)"
        onClick={() => {
          editor.chain().focus().insertPageBreak().run();
          toast.success("Nova página adicionada");
        }}
      >
        <FilePlus className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">Nova página</span>
      </Button>
      {onOpenPageSettings && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2"
          title="Rodapé, números de página e marca d'água"
          onClick={onOpenPageSettings}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Página</span>
        </Button>
      )}

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              title="Formatar documento (ABNT)"
            >
              <BookMarked className="mr-1.5 h-4 w-4" /> Formatar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
              Normas ABNT
            </div>
            {ABNT_OPTIONS.map((opt) => {
              const active = abntMode === opt.value;
              return (
                <DropdownMenuItem
                  key={opt.value || "none"}
                  onClick={() => {
                    onAbntChange?.(opt.value);
                    toast.success(active ? "Formatação mantida" : `Aplicado: ${opt.label}`);
                  }}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <div className="flex w-full items-center gap-2">
                    {active ? (
                      <CheckIcon className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                    <span className="font-medium">{opt.label}</span>
                  </div>
                  <span className="pl-5 text-xs text-muted-foreground">{opt.desc}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-8">
              <Download className="mr-1.5 h-4 w-4" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToPdf(editor, title)}>
              <FileText className="mr-2 h-4 w-4" /> PDF (.pdf)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToDocx(editor, title)}>
              <FileText className="mr-2 h-4 w-4" /> Word (.docx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
