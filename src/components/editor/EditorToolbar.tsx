import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Undo, Redo,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Download, FileText, BookMarked, Check as CheckIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRef } from "react";
import { exportToPdf, exportToDocx } from "@/lib/export";

interface Props {
  editor: Editor | null;
  title: string;
  abntMode?: string;
  onAbntChange?: (mode: string) => void;
}

const ABNT_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "", label: "Sem formatação", desc: "Remove formatação ABNT" },
  { value: "abnt", label: "ABNT — Times New Roman", desc: "Trabalho acadêmico padrão (fonte Times, 12pt, espaço 1,5, margens 3/2/2/3 cm)" },
  { value: "abnt abnt-arial", label: "ABNT — Arial", desc: "Trabalho acadêmico (fonte Arial, 12pt, espaço 1,5)" },
  { value: "abnt abnt-references", label: "ABNT — Referências", desc: "Alinhamento à esquerda, espaço simples, sem recuo" },
  { value: "abnt abnt-cover", label: "ABNT — Capa", desc: "Tudo centralizado e em maiúsculas" },
];

const Btn = ({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
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

export function EditorToolbar({ editor, title }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;

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

  const headingLevel = (() => {
    for (const l of [1, 2, 3, 4, 5, 6] as const) {
      if (editor.isActive("heading", { level: l })) return String(l);
    }
    return "p";
  })();

  return (
    <div className="sticky top-12 z-10 flex flex-wrap items-center gap-1 border-b bg-toolbar px-3 py-1.5 text-toolbar-foreground">
      <Btn label="Desfazer" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></Btn>
      <Btn label="Refazer" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></Btn>
      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select
        value={headingLevel}
        onValueChange={(v) => {
          if (v === "p") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(v) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
        }}
      >
        <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Texto normal</SelectItem>
          <SelectItem value="1">Título 1</SelectItem>
          <SelectItem value="2">Título 2</SelectItem>
          <SelectItem value="3">Título 3</SelectItem>
          <SelectItem value="4">Título 4</SelectItem>
          <SelectItem value="5">Título 5</SelectItem>
          <SelectItem value="6">Título 6</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn label="Negrito (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
      <Btn label="Itálico (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
      <Btn label="Sublinhado (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
      <Btn label="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn label="Alinhar à esquerda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Btn>
      <Btn label="Centralizar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Btn>
      <Btn label="Alinhar à direita" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Btn>
      <Btn label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn label="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
      <Btn label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
      <Btn label="Citação" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>

      <Separator orientation="vertical" className="mx-1 h-6" />
      <Btn label="Link" active={editor.isActive("link")} onClick={setLink}><LinkIcon className="h-4 w-4" /></Btn>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" title="Imagem"><ImageIcon className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>Enviar do computador</DropdownMenuItem>
          <DropdownMenuItem onClick={insertImageUrl}>Inserir por URL</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ""; }}
      />
      <Btn label="Tabela" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></Btn>

      <div className="ml-auto flex items-center gap-1">
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
