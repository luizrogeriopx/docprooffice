import type { EditorView } from "@tiptap/pm/view";
import type { LayoutBlock, PaginationBreakSpec, PaginationResult } from "./types";
import { measureBlockLines, getPaginationBlockPosition } from "./measurement";
import { A4_HEIGHT_PX, A4_PAGE_GAP_PX } from "./types";

export function runPaginationEngine(
  view: EditorView,
  proseEl: HTMLElement,
  pageHeight: number,
  paddingTop: number,
  paddingBottom: number,
  scale: number,
  abntMode: string,
  layoutMode: string
): PaginationResult {
  const isPresentation = layoutMode === "presentation";
  const pageStride = pageHeight + A4_PAGE_GAP_PX;
  const usablePageHeight = pageHeight - paddingTop - paddingBottom;

  const autoBreaks: PaginationBreakSpec[] = [];

  // 1. Collapse the editor to unpaginated state to measure natural sizes
  proseEl.classList.add("docpro-measuring-pagination");

  // Reset manual page breaks height to 0px temporarily to get correct unpaginated coordinates
  Array.from(proseEl.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (child.classList.contains("docpro-page-break") || child.hasAttribute("data-page-break")) {
      child.style.setProperty("--docpro-page-break-height", "0px");
    }
  });

  const flowItems: LayoutBlock[] = [];

  try {
    const collapsedProseRect = proseEl.getBoundingClientRect();
    const renderedScale = proseEl.offsetWidth > 0 ? collapsedProseRect.width / proseEl.offsetWidth : scale;
    const visualScale = renderedScale > 0 ? renderedScale : 1;

    // Query all top-level editable blocks, excluding breaks and absolute layers
    const blocks = Array.from(
      proseEl.querySelectorAll<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6, pre, table, tr, .resizable-image-wrap, .docpro-page-break")
    ).filter((block) => {
      const containingTable = block.closest("table");
      
      // If it's a TABLE element:
      if (block.tagName === "TABLE") {
        const tableHeight = block.getBoundingClientRect().height / visualScale;
        // Keep it only if it fits on a single page
        return tableHeight <= usablePageHeight + 1;
      }
      
      // If it's a TR element:
      if (block.tagName === "TR") {
        if (!containingTable) return false;
        const tableHeight = containingTable.getBoundingClientRect().height / visualScale;
        // Keep it only if the table is too long and needs to be split
        return tableHeight > usablePageHeight + 1;
      }
      
      // For any other element nested inside a table (like paragraphs in cells):
      if (containingTable) {
        return false;
      }

      if (block.closest("li") && block.tagName !== "LI") return false;
      if (block.closest(".docpro-page-break") && !block.classList.contains("docpro-page-break")) return false;
      if (
        block.classList.contains("resizable-image-wrap") &&
        (block.getAttribute("data-align") === "behind" || block.getAttribute("data-align") === "front")
      ) {
        return false;
      }
      return true;
    });

    // Pre-build descendant node map to optimize O(N) DOM lookup to O(1) in layout measurements
    const nodeMap = new Map<HTMLElement, number>();
    try {
      view.state.doc.descendants((node, pos) => {
        const dom = view.nodeDOM(pos) as HTMLElement;
        if (dom) {
          nodeMap.set(dom, pos);
        }
        return true;
      });
    } catch {
      // ignore
    }

    // 2. Measure block boundaries and extract line ranges
    blocks.forEach((block) => {
      const rect = block.getBoundingClientRect();
      if (block.classList.contains("docpro-page-break") || (rect.width > 0 && rect.height > 0)) {
        const tag = block.tagName.toLowerCase();
        const blockStartPos = getPaginationBlockPosition(view, block, nodeMap);
        if (blockStartPos === null) return;

        const widgetTag = tag === "li" ? "li" : tag === "tr" ? "tr" : "div";
        const canSplitText = (tag === "p" || tag === "li" || tag === "pre") && !block.querySelector("img");

        if (canSplitText && block.textContent) {
          const lines = new Map<number, { top: number; bottom: number; pos: number }>();
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          let textNode: Node | null;

          while ((textNode = walker.nextNode())) {
            const text = textNode.textContent ?? "";
            if (!text) continue;
            const fullRange = document.createRange();
            fullRange.selectNodeContents(textNode);
            const lineRects = Array.from(fullRange.getClientRects()).filter((lineRect) => lineRect.height > 0);

            lineRects.forEach((lineRect) => {
              // Binary search character offset for this line segment
              let low = 0;
              let high = Math.max(0, text.length - 1);
              let firstOffset = 0;
              while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const charRange = document.createRange();
                charRange.setStart(textNode as Node, mid);
                charRange.setEnd(textNode as Node, Math.min(text.length, mid + 1));
                const charRects = charRange.getClientRects();
                if (charRects.length > 0) {
                  const charRect = charRects[0];
                  if (charRect.top < lineRect.top - 0.5) {
                    low = mid + 1;
                  } else {
                    firstOffset = mid;
                    high = mid - 1;
                  }
                } else {
                  high = mid - 1;
                }
              }

              let pos = blockStartPos;
              try {
                pos = view.posAtDOM(textNode as Node, firstOffset);
              } catch {
                /* fallback to block start */
              }

              const naturalTop = (lineRect.top - collapsedProseRect.top) / visualScale + paddingTop;
              const naturalBottom = (lineRect.bottom - collapsedProseRect.top) / visualScale + paddingTop;
              const key = Math.round(naturalTop * 2);
              const existing = lines.get(key);

              if (existing) {
                lines.set(key, {
                  top: Math.min(existing.top, naturalTop),
                  bottom: Math.max(existing.bottom, naturalBottom),
                  pos: Math.min(existing.pos, pos),
                });
              } else {
                lines.set(key, { top: naturalTop, bottom: naturalBottom, pos });
              }
            });
          }

          const sortedLines = Array.from(lines.values()).sort((a, b) => a.top - b.top);
          sortedLines.forEach((line, idx) => {
            // Widow/Orphan helper flag: mark if it's the last line of a multi-line paragraph
            const isLastLineOfMulti = sortedLines.length > 1 && idx === sortedLines.length - 1;

            flowItems.push({
              element: block,
              blockStartPos: idx === 0 ? blockStartPos : line.pos,
              naturalTop: line.top,
              naturalBottom: line.bottom,
              tag: idx === 0 ? widgetTag : "span",
              splittableLine: idx > 0,
            });

            // Add virtual metadata for widow control
            if (isLastLineOfMulti) {
              (flowItems[flowItems.length - 1] as any).isLastLine = true;
            }
          });
        } else {
          flowItems.push({
            element: block,
            blockStartPos,
            naturalTop: (rect.top - collapsedProseRect.top) / visualScale + paddingTop,
            naturalBottom: (rect.bottom - collapsedProseRect.top) / visualScale + paddingTop,
            tag: widgetTag,
            splittableLine: false,
          });
        }
      }
    });
  } finally {
    proseEl.classList.remove("docpro-measuring-pagination");
  }

  // 3. Sort items by document position and layout top boundary
  flowItems.sort((a, b) => a.blockStartPos - b.blockStartPos || a.naturalTop - b.naturalTop);

  let accumulatedShift = 0;
  let currentPageIndex = 0;
  let totalCalculatedHeight = paddingTop + paddingBottom;

  let pendingHeading: { item: LayoutBlock; lineTop: number; lineBottom: number } | null = null;

  for (let i = 0; i < flowItems.length; i++) {
    const item = flowItems[i];
    const isManualBreak = item.element.classList.contains("docpro-page-break");
    let lineTop = item.naturalTop + accumulatedShift;
    let lineBottom = item.naturalBottom + accumulatedShift;

    const nextPageContentTop = (currentPageIndex + 1) * pageStride + paddingTop;
    const pageBottom = currentPageIndex * pageStride + pageHeight - paddingBottom;

    if (isManualBreak) {
      const height = Math.max(40, nextPageContentTop - lineTop);
      item.element.style.setProperty("--docpro-page-break-height", `${height}px`);
      accumulatedShift += height;
      currentPageIndex++;

      const finalBottom = item.naturalTop + accumulatedShift;
      totalCalculatedHeight = Math.max(totalCalculatedHeight, finalBottom + paddingBottom);
      pendingHeading = null;
      continue;
    }

    // ABNT/Word Heading protection: check if it's a heading
    const blockTag = item.element.tagName.toLowerCase();
    const isHeading = blockTag.startsWith("h") && blockTag.length === 2 && !isNaN(Number(blockTag[1]));

    if (isHeading) {
      pendingHeading = { item, lineTop, lineBottom };
    }

    if (lineBottom > pageBottom) {
      const tag = item.element.tagName.toLowerCase();
      const itemHeight = item.naturalBottom - item.naturalTop;
      const isAtPageStart = lineTop <= currentPageIndex * pageStride + paddingTop + 10;
      const shouldMove = item.splittableLine || itemHeight <= usablePageHeight + 1 || !isAtPageStart;

      if (shouldMove) {
        let breakPos = item.blockStartPos;
        let breakTag = item.tag;
        let finalHeight = Math.max(0, nextPageContentTop - lineTop);

        // Keep-with-next Heading Protection:
        // If a heading fits on page N, but the next content overflows and is pushed to page N+1:
        // We push the heading to page N+1 as well.
        if (pendingHeading && pendingHeading.item !== item && pendingHeading.lineBottom <= pageBottom) {
          breakPos = pendingHeading.item.blockStartPos;
          breakTag = pendingHeading.item.tag;
          finalHeight = Math.max(0, nextPageContentTop - pendingHeading.lineTop);
          pendingHeading = null;

          // Re-adjust coordinates of current item as it shifts with the heading
          lineTop += finalHeight;
          lineBottom += finalHeight;
        }

        // Widow Protection:
        // If we are pushing the last line of a multi-line paragraph to page N+1,
        // we should also push the previous line to page N+1 to prevent leaving a single line widow.
        const isLastLine = (item as any).isLastLine;
        if (isLastLine && i > 0) {
          const prevItem = flowItems[i - 1];
          if (prevItem.element === item.element && prevItem.splittableLine) {
            // Apply the page break before the previous line instead!
            const prevLineTop = prevItem.naturalTop + accumulatedShift;
            breakPos = prevItem.blockStartPos;
            breakTag = prevItem.tag;
            finalHeight = Math.max(0, nextPageContentTop - prevLineTop);

            lineTop += finalHeight;
            lineBottom += finalHeight;
          }
        }

        if (finalHeight > 0) {
          let repeatedHeaderData: any = undefined;
          if (tag === "tr") {
            const parentTable = item.element.closest("table");
            if (parentTable) {
              const firstRow = parentTable.querySelector("tr");
              if (firstRow && firstRow !== item.element) {
                const cells = Array.from(firstRow.querySelectorAll("td, th"));
                repeatedHeaderData = {
                  colsCount: cells.length,
                  headerHtml: firstRow.innerHTML,
                };
              }
            }
          }

          autoBreaks.push({
            pos: breakPos,
            height: finalHeight,
            tag: breakTag,
            repeatedTableHeaderHtml: repeatedHeaderData?.headerHtml,
            tableColsCount: repeatedHeaderData?.colsCount,
          });
          accumulatedShift += finalHeight;
        }
        currentPageIndex++;
      } else {
        // Content is oversized and can't fit on one page. Advance index without a break.
        currentPageIndex = Math.max(currentPageIndex + 1, Math.floor(lineBottom / pageStride));
      }
    } else {
      // If we process a normal block that fits, the heading is no longer orphaned
      if (!isHeading && item.tag !== "span") {
        pendingHeading = null;
      }
    }

    const finalBottom = item.naturalBottom + accumulatedShift;
    totalCalculatedHeight = Math.max(totalCalculatedHeight, finalBottom + paddingBottom);
  }

  // Ensure breaks are sorted by document position
  autoBreaks.sort((a, b) => a.pos - b.pos);

  const calculatedPages = Math.max(
    isPresentation ? 1 : 1,
    Math.floor(Math.max(0, totalCalculatedHeight - 1) / pageStride) + 1
  );

  return {
    breaks: autoBreaks,
    pageCount: calculatedPages,
  };
}
