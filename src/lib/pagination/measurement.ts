import type { EditorView } from "@tiptap/pm/view";
import type { LayoutBlock } from "./types";

export function getBlockDocumentPosition(view: EditorView, block: HTMLElement): number | null {
  let found: number | null = null;
  try {
    view.state.doc.descendants((node, pos) => {
      if (found !== null) return false;
      if (view.nodeDOM(pos) === block) {
        found = pos;
        return false;
      }
      return true;
    });
  } catch {
    /* ignore */
  }
  return found;
}

export function getPaginationBlockPosition(
  view: EditorView,
  block: HTMLElement,
  nodeMap?: Map<HTMLElement, number>
): number | null {
  if (nodeMap) {
    const mapped = nodeMap.get(block);
    if (mapped !== undefined) return mapped;
  } else {
    const nodePos = getBlockDocumentPosition(view, block);
    if (nodePos !== null) return nodePos;
  }

  try {
    return view.posAtDOM(block, 0);
  } catch {
    return null;
  }
}

/**
 * Optimized binary search to find the character offset of the leftmost character 
 * in a Text node that lies on a specific visual line Rect.
 */
export function findCharOffsetForLine(textNode: Text, lineRect: DOMRect): number {
  const textLen = textNode.textContent?.length ?? 0;
  if (textLen <= 1) return 0;

  let low = 0;
  let high = textLen - 1;
  let bestOffset = 0;
  let bestDiff = Infinity;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const charRange = document.createRange();
    charRange.setStart(textNode, mid);
    charRange.setEnd(textNode, Math.min(textLen, mid + 1));
    const charRects = charRange.getClientRects();

    if (charRects.length > 0) {
      const charRect = charRects[0];
      const charTop = charRect.top;

      // Check if character top fits inside the vertical bounds of the line
      if (charTop < lineRect.top - 2) {
        low = mid + 1;
      } else if (charTop > lineRect.bottom - 2) {
        high = mid - 1;
      } else {
        // It is on the same line. Match the leftmost position.
        const diff = Math.abs(charRect.left - lineRect.left);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestOffset = mid;
        }
        // Keep searching leftward for the actual starting character
        high = mid - 1;
      }
    } else {
      high = mid - 1;
    }
  }

  return bestOffset;
}

/**
 * Measures the lines of a block element and transforms them into scaled logical LayoutBlocks.
 */
export function measureBlockLines(
  view: EditorView,
  block: HTMLElement,
  collapsedProseRect: DOMRect,
  visualScale: number,
  paddingTop: number,
  widgetTag: string,
  blockStartPos: number
): LayoutBlock[] {
  const flowItems: LayoutBlock[] = [];
  const textNodes: Text[] = [];

  const walk = (el: Node) => {
    if (el.nodeType === Node.TEXT_NODE) {
      textNodes.push(el as Text);
    } else {
      el.childNodes.forEach(walk);
    }
  };
  walk(block);

  if (textNodes.length === 0) {
    // Empty block or block without direct text nodes (like images or tables)
    const rect = block.getBoundingClientRect();
    const naturalTop = (rect.top - collapsedProseRect.top) / visualScale + paddingTop;
    const naturalBottom = (rect.bottom - collapsedProseRect.top) / visualScale + paddingTop;

    flowItems.push({
      element: block,
      blockStartPos,
      naturalTop,
      naturalBottom,
      tag: widgetTag,
      splittableLine: false,
    });
  } else {
    // Extract line rectangles by building ranges
    textNodes.forEach((textNode) => {
      const parentPos = getPaginationBlockPosition(view, block);
      if (parentPos === null) return;

      // Find start pos of text node relative to the block
      let relativePos = 0;
      let foundNode = false;

      const countPos = (n: Node) => {
        if (foundNode) return;
        if (n === textNode) {
          foundNode = true;
          return;
        }
        if (n.nodeType === Node.TEXT_NODE) {
          relativePos += n.textContent?.length ?? 0;
        } else {
          n.childNodes.forEach(countPos);
        }
      };
      countPos(block);

      const nodePos = parentPos + relativePos;

      const fullRange = document.createRange();
      fullRange.selectNodeContents(textNode);
      const lineRects = Array.from(fullRange.getClientRects()).filter((lineRect) => lineRect.height > 0);

      // Group rects by top to capture lines
      const lines = new Map<number, { top: number; bottom: number; pos: number }>();

      lineRects.forEach((lineRect) => {
        const roundedTop = Math.round(lineRect.top);
        if (!lines.has(roundedTop)) {
          const startOffset = findCharOffsetForLine(textNode, lineRect);
          const naturalTop = (lineRect.top - collapsedProseRect.top) / visualScale + paddingTop;
          const naturalBottom = (lineRect.bottom - collapsedProseRect.top) / visualScale + paddingTop;

          lines.set(roundedTop, {
            top: naturalTop,
            bottom: naturalBottom,
            pos: nodePos + startOffset,
          });
        }
      });

      const sortedLines = Array.from(lines.values()).sort((a, b) => a.top - b.top);
      sortedLines.forEach((line, idx) => {
        // If it's the first line, we assign the blockStartPos (before the block) and widgetTag
        // so it pushes the block as a whole.
        // If it's idx > 0, we assign it as a splittable span inline inside the block content.
        flowItems.push({
          element: block,
          blockStartPos: idx === 0 ? blockStartPos : line.pos,
          naturalTop: line.top,
          naturalBottom: line.bottom,
          tag: idx === 0 ? widgetTag : "span",
          splittableLine: idx > 0,
        });
      });
    });
  }

  return flowItems;
}
