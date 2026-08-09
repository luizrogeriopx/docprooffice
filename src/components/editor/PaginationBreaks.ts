import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";

export type PaginationBreakSpec = {
  pos: number;
  height: number;
  tag?: string;
  tableHeaderHtml?: string;
  tableColsCount?: number;
};

export const paginationBreaksKey = new PluginKey<DecorationSet>("docproPaginationBreaks");

export function paginationBreaksSignature(breaks: PaginationBreakSpec[]) {
  return breaks
    .map(
      (item) =>
        `${item.pos}:${Math.round(item.height)}:${item.tag || "div"}:${
          item.tableHeaderHtml ? "h" : "nh"
        }`,
    )
    .join("|");
}

export function setPaginationBreaks(view: EditorView, breaks: PaginationBreakSpec[]) {
  view.dispatch(
    view.state.tr
      .setMeta(paginationBreaksKey, breaks)
      .setMeta("addToHistory", false)
      .setMeta("preventUpdate", true),
  );
}

export const PaginationBreaks = Extension.create({
  name: "paginationBreaks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: paginationBreaksKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, value) {
            const meta = tr.getMeta(paginationBreaksKey) as PaginationBreakSpec[] | undefined;

            if (meta) {
              const widgets = meta.map((item) =>
                Decoration.widget(
                  item.pos,
                  () => {
                    const tag = item.tag || "div";
                    const element = document.createElement(tag);
                    element.className = "docpro-auto-page-break";
                    element.setAttribute("data-docpro-auto-page-break", "true");
                    
                    if (tag === "tr") {
                      if (item.tableHeaderHtml && item.tableColsCount) {
                        element.className = "docpro-auto-page-break docpro-table-break-row";
                        element.innerHTML = `
                          <td colspan="${item.tableColsCount}" style="border: none !important; padding: 0 !important; background: transparent !important;">
                            <div style="height: ${Math.max(0, item.height)}px;"></div>
                            <table class="docpro-repeated-header-table" style="width: 100%; border-collapse: collapse; border: none !important; margin: 0 !important;">
                              <thead>
                                <tr style="background: inherit; border: inherit;">
                                  ${item.tableHeaderHtml}
                                </tr>
                              </thead>
                            </table>
                          </td>
                        `;
                      } else {
                        element.innerHTML = `<td colspan="100" style="height: ${Math.max(0, item.height)}px; border: none !important; padding: 0 !important; background: transparent !important;"></td>`;
                      }
                    } else if (tag === "span") {
                      element.style.display = "block";
                      element.style.width = "0";
                      element.style.height = `${Math.max(0, item.height)}px`;
                      element.style.pointerEvents = "none";
                    } else {
                      element.style.setProperty(
                        "--docpro-auto-page-break-height",
                        `${Math.max(0, item.height)}px`,
                      );
                      if (tag === "li") {
                        element.style.listStyle = "none";
                      }
                    }
                    return element;
                  },
                  {
                    key: `docpro-auto-page-break-${item.pos}-${Math.round(item.height)}-${item.tag || "div"}-${
                      item.tableHeaderHtml ? "h" : "nh"
                    }`,
                    side: -1,
                  },
                ),
              );
              return DecorationSet.create(tr.doc, widgets);
            }

            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return paginationBreaksKey.getState(state);
          },
        },
      }),
    ];
  },
});
