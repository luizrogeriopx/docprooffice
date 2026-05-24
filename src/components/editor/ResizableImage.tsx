import { mergeAttributes, Node, nodeInputRule } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import {
  AlignLeft, AlignCenter, AlignRight, Image as ImageIcon,
  Layers, SquareStack, Trash2, MoveDiagonal,
} from "lucide-react";

export type ImageAlign = "inline" | "left" | "right" | "center" | "behind" | "front";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: { src: string; alt?: string; width?: number; align?: ImageAlign; x?: number; y?: number }) => ReturnType;
    };
  }
}

export const ResizableImage = Node.create({
  name: "resizableImage",
  group: "block",
  inline: false,
  draggable: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      width: { default: 480, parseHTML: (el) => parseInt(el.getAttribute("width") || "480", 10) || 480 },
      align: { default: "inline" as ImageAlign, parseHTML: (el) => (el.getAttribute("data-align") as ImageAlign) || "inline" },
      x: { default: 0, parseHTML: (el) => parseInt(el.getAttribute("data-x") || "0", 10) || 0 },
      y: { default: 0, parseHTML: (el) => parseInt(el.getAttribute("data-y") || "0", 10) || 0 },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, align, x, y, ...rest } = HTMLAttributes as any;
    return ["img", mergeAttributes(rest, {
      width: String(width ?? 480),
      "data-align": align ?? "inline",
      "data-x": String(x ?? 0),
      "data-y": String(y ?? 0),
      style: `max-width:100%;`,
    })];
  },

  addCommands() {
    return {
      setImage: (options) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: options }),
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/,
        type: this.type,
        getAttributes: (m) => ({ src: m[2], alt: m[1] }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

function ResizableImageView({ node, updateAttributes, selected, deleteNode }: NodeViewProps) {
  const { src, alt, width, align, x, y } = node.attrs as {
    src: string; alt?: string; width: number; align: ImageAlign; x: number; y: number;
  };

  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  // Resize handler
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current?.offsetWidth ?? width;
    setResizing(true);
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newW = Math.max(60, Math.min(1200, startWidth + dx));
      updateAttributes({ width: newW });
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Drag handler for behind/front positioning
  const isAbsolute = align === "behind" || align === "front";
  const onDragStart = (e: React.MouseEvent) => {
    if (!isAbsolute) return;
    if ((e.target as HTMLElement).dataset.handle) return;
    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = x;
    const startY = y;
    const onMove = (ev: MouseEvent) => {
      updateAttributes({
        x: startX + (ev.clientX - startMouseX),
        y: startY + (ev.clientY - startMouseY),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Wrapper style based on align
  const wrapperStyle: React.CSSProperties = (() => {
    switch (align) {
      case "left":   return { float: "left",  margin: "0 1em 0.5em 0", clear: "left",  width };
      case "right":  return { float: "right", margin: "0 0 0.5em 1em", clear: "right", width };
      case "center": return { display: "block", margin: "0.5em auto", width };
      case "behind": return { position: "absolute", left: x, top: y, width, zIndex: 0, pointerEvents: "auto" };
      case "front":  return { position: "absolute", left: x, top: y, width, zIndex: 20, pointerEvents: "auto" };
      default:       return { display: "inline-block", verticalAlign: "middle", width };
    }
  })();

  // For absolute modes, render a small placeholder in-flow so the node stays in document
  const showToolbar = selected || resizing;

  return (
    <NodeViewWrapper
      as={isAbsolute ? "span" : "div"}
      className="resizable-image-wrap"
      data-align={align}
      style={isAbsolute ? { position: "relative", display: "inline" } : undefined}
    >
      <div
        ref={wrapRef}
        className={`docpro-image-frame ${selected ? "is-selected" : ""}`}
        style={wrapperStyle}
        onMouseDown={onDragStart}
      >
        {showToolbar && (
          <div
            className="docpro-image-toolbar"
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ToolbarBtn title="Em linha"  active={align === "inline"} onClick={() => updateAttributes({ align: "inline" })}><ImageIcon className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Esquerda"  active={align === "left"}   onClick={() => updateAttributes({ align: "left" })}><AlignLeft className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Centro"    active={align === "center"} onClick={() => updateAttributes({ align: "center" })}><AlignCenter className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="Direita"   active={align === "right"}  onClick={() => updateAttributes({ align: "right" })}><AlignRight className="h-3.5 w-3.5" /></ToolbarBtn>
            <span className="docpro-image-toolbar-sep" />
            <ToolbarBtn title="Atrás do texto" active={align === "behind"} onClick={() => updateAttributes({ align: "behind", x: x || 40, y: y || 40 })}><Layers className="h-3.5 w-3.5" /></ToolbarBtn>
            <ToolbarBtn title="À frente do texto" active={align === "front"} onClick={() => updateAttributes({ align: "front", x: x || 40, y: y || 40 })}><SquareStack className="h-3.5 w-3.5" /></ToolbarBtn>
            <span className="docpro-image-toolbar-sep" />
            <ToolbarBtn title="Excluir" onClick={() => deleteNode()}><Trash2 className="h-3.5 w-3.5" /></ToolbarBtn>
          </div>
        )}
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          draggable={false}
          style={{ width: "100%", height: "auto", display: "block", cursor: isAbsolute ? "move" : "default" }}
        />
        {selected && (
          <span
            data-handle="se"
            className="docpro-image-handle"
            onMouseDown={onResizeStart}
            contentEditable={false}
            title="Redimensionar"
          >
            <MoveDiagonal className="h-3 w-3" />
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function ToolbarBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`docpro-image-toolbar-btn ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}
