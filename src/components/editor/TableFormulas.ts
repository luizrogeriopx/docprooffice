import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { evalCell, formatResult, type Grid } from "@/lib/formula-engine";

const pluginKey = new PluginKey("tableFormulas");

function buildDecorations(state: any): DecorationSet {
  const decos: Decoration[] = [];
  const { doc, selection } = state;

  doc.descendants((node: any, pos: number) => {
    if (node.type.name !== "table") return true;

    const grid: Grid = [];
    type CellInfo = { row: number; col: number; pos: number; size: number; text: string };
    const cellInfos: CellInfo[] = [];

    let rowIdx = 0;
    node.forEach((rowNode: any, rowOffset: number) => {
      if (rowNode.type.name !== "tableRow") return;
      const rowPos = pos + 1 + rowOffset;
      grid[rowIdx] = [];
      let colIdx = 0;
      rowNode.forEach((cellNode: any, cellOffset: number) => {
        if (cellNode.type.name !== "tableCell" && cellNode.type.name !== "tableHeader") return;
        const cellPos = rowPos + 1 + cellOffset;
        const text = (cellNode.textContent as string) ?? "";
        grid[rowIdx][colIdx] = text;
        cellInfos.push({ row: rowIdx, col: colIdx, pos: cellPos, size: cellNode.nodeSize, text });
        colIdx++;
      });
      rowIdx++;
    });

    for (const info of cellInfos) {
      if (!info.text.trim().startsWith("=")) continue;
      const selFrom = selection.from;
      const inside = selFrom > info.pos && selFrom < info.pos + info.size;
      if (inside) continue;

      let display: string;
      let isErr = false;
      try {
        const r = evalCell(grid, info.row, info.col);
        display = formatResult(r);
      } catch {
        display = "#ERR";
        isErr = true;
      }
      decos.push(
        Decoration.node(info.pos, info.pos + info.size, {
          class: isErr ? "has-formula has-formula-error" : "has-formula",
          "data-result": display,
        })
      );
    }
    return false;
  });

  return DecorationSet.create(doc, decos);
}

export const TableFormulas = Extension.create({
  name: "tableFormulas",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations(state) {
            return buildDecorations(state);
          },
        },
      }),
    ];
  },
});
