export interface PageDimensions {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export interface PaginationBreakSpec {
  pos: number;
  height: number;
  tag: string; // "div" | "span" | "li" | "tr"
  repeatedTableHeaderHtml?: string;
  tableColsCount?: number;
}

export interface LayoutBlock {
  element: HTMLElement;
  blockStartPos: number;
  naturalTop: number;
  naturalBottom: number;
  tag: string;
  splittableLine: boolean;
}

export interface PaginationResult {
  breaks: PaginationBreakSpec[];
  pageCount: number;
}

export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;
export const A4_PAGE_GAP_PX = 32;
