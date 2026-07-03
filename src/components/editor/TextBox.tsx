import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  MoveHorizontal,
} from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textBox: {
      insertTextBox: (options?: {
        x?: number;
        y?: number;
        width?: number;
        align?: "left" | "center" | "right";
      }) => ReturnType;
    };
  }
}

export const TextBox = Node.create({
  name: "textBox",
  group: "block",
  content: "inline*",
  defining: true,
  draggable: false, // We handle drag manually
  selectable: true,

  addAttributes() {
    return {
      x: { default: 100 },
      y: { default: 100 },
      width: { default: 250 },
      align: { default: "left" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="text-box"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { x, y, width, align, ...rest } = HTMLAttributes as any;
    return [
      "div",
      mergeAttributes(rest, {
        "data-type": "text-box",
        "data-x": String(x ?? 100),
        "data-y": String(y ?? 100),
        "data-width": String(width ?? 250),
        "data-align": align ?? "left",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertTextBox:
        (options) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TextBoxView);
  },
});

function TextBoxView({ editor, node, updateAttributes, selected, deleteNode, getPos }: NodeViewProps) {
  const { x, y, width, align } = node.attrs as {
    x: number;
    y: number;
    width: number;
    align: "left" | "center" | "right";
  };

  const isPresentation = editor.state.doc.attrs.layout === "presentation";
  const wrapRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  // Auto clean up when empty on blur
  const prevSelectedRef = useRef(selected);
  useEffect(() => {
    if (prevSelectedRef.current && !selected) {
      const text = node.textContent || "";
      if (text.trim() === "") {
        setTimeout(() => {
          try {
            deleteNode();
          } catch (e) {}
        }, 50);
      }
    }
    prevSelectedRef.current = selected;
  }, [selected, node.textContent, deleteNode]);

  // Drag handler for positioning
  const onDragStart = (e: React.MouseEvent) => {
    if (!isPresentation) return;
    
    // If clicking on toolbar or resize handle, do not drag
    const target = e.target as HTMLElement;
    if (target.closest(".docpro-textbox-toolbar") || target.closest(".docpro-textbox-resize-handle")) {
      return;
    }
    
    // If clicking contenteditable area, let the cursor focus immediately
    if (target.closest("[data-node-view-content]")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Select the node explicitly
    const pos = getPos();
    if (typeof pos === "number") {
      const selection = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(editor.state.tr.setSelection(selection));
    }

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = x;
    const startY = y;

    const el = wrapRef.current;
    const w = el ? el.offsetWidth : width;
    const h = el ? el.offsetHeight : 40;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX;
      const dy = ev.clientY - startMouseY;

      let nextX = startX + dx;
      let nextY = startY + dy;

      // Slide size: 794x446. Editable area inside padding (48px left/right, 32px top/bottom): 698x382.
      // Editor area center: CenterX = 349, CenterY = 191.
      const pageIndex = Math.floor(Math.max(0, nextY) / 478);
      const pageCenterY = pageIndex * 478 + 191;

      const centerX = nextX + w / 2;
      const centerY = nextY + h / 2;

      let isSnapX = false;
      let isSnapY = false;

      // 4px snap margin relative to editor area center (which maps to slide visual center)
      if (Math.abs(centerX - 349) < 4) {
        nextX = 349 - w / 2;
        isSnapX = true;
      }
      if (Math.abs(centerY - pageCenterY) < 4) {
        nextY = pageCenterY - h / 2;
        isSnapY = true;
      }

      // Constrain within slide boundaries (inside editor padding)
      nextX = Math.max(0, Math.min(698 - w, nextX));
      
      const relativeY = nextY - pageIndex * 478;
      const constrainedRelY = Math.max(0, Math.min(382 - h, relativeY));
      nextY = constrainedRelY + pageIndex * 478;

      updateAttributes({ x: nextX, y: nextY });

      // Dispatch custom event to draw guide lines in the page wrapper (visual guides use root coordinates 397 / 223)
      window.dispatchEvent(
        new CustomEvent("docpro-element-drag", {
          detail: {
            dragging: true,
            showVGuide: isSnapX,
            showHGuide: isSnapY,
            pageIndex,
          },
        })
      );
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      
      window.dispatchEvent(
        new CustomEvent("docpro-element-drag", {
          detail: { dragging: false },
        })
      );
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Horizontal Resize handler
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = width;
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newW = Math.max(80, Math.min(794, startWidth + dx));
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

  // Styles based on mode
  const style: React.CSSProperties = isPresentation
    ? {
        position: "absolute",
        left: x,
        top: y,
        width: width,
        minHeight: "1.6em",
        textAlign: align,
      }
    : {
        width: "100%",
        textAlign: align,
        margin: "0.5em 0",
      };

  const showToolbar = selected || resizing;

  return (
    <NodeViewWrapper
      className="docpro-textbox-wrap"
      style={isPresentation ? { position: "relative", display: "inline" } : undefined}
    >
      <div
        ref={wrapRef}
        className={`docpro-textbox-frame ${selected ? "is-selected" : ""} ${isPresentation ? "presentation-mode" : ""}`}
        style={style}
        onMouseDown={onDragStart}
      >
        {/* Absolute Toolbar */}
        {showToolbar && isPresentation && (
          <div
            className="docpro-textbox-toolbar"
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ToolbarBtn
              title="Alinhar à esquerda"
              active={align === "left"}
              onClick={() => updateAttributes({ align: "left" })}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              title="Centralizar"
              active={align === "center"}
              onClick={() => updateAttributes({ align: "center" })}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              title="Alinhar à direita"
              active={align === "right"}
              onClick={() => updateAttributes({ align: "right" })}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <span className="docpro-textbox-toolbar-sep" />
            <ToolbarBtn title="Excluir Caixa" onClick={() => deleteNode()}>
              <Trash2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
          </div>
        )}

        {/* Node content editable area */}
        <NodeViewContent
          className="docpro-textbox-content"
          style={{ width: "100%" }}
        />

        {/* Resize handle (right side) */}
        {selected && isPresentation && (
          <span
            className="docpro-textbox-resize-handle"
            onMouseDown={onResizeStart}
            contentEditable={false}
            title="Redimensionar largura"
          >
            <MoveHorizontal className="h-3 w-3" />
          </span>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`docpro-textbox-toolbar-btn ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}
