import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";

export type PaginationBreakSpec = {
  pos: number;
  height: number;
};

export const paginationBreaksKey = new PluginKey<DecorationSet>("docproPaginationBreaks");

export function paginationBreaksSignature(breaks: PaginationBreakSpec[]) {
  return breaks.map((item) => `${item.pos}:${Math.round(item.height)}`).join("|");
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
                    const element = document.createElement("span");
                    element.className = "docpro-auto-page-break";
                    element.setAttribute("data-docpro-auto-page-break", "true");
                    element.style.setProperty(
                      "--docpro-auto-page-break-height",
                      `${Math.max(0, item.height)}px`,
                    );
                    return element;
                  },
                  {
                    key: `docpro-auto-page-break-${item.pos}-${Math.round(item.height)}`,
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
