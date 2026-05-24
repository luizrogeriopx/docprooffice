export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PageNumberFormat = "n" | "page-n" | "page-n-of-total" | "dash-n-dash";

export interface PageSettings {
  footer: { enabled: boolean; text: string };
  pageNumber: {
    enabled: boolean;
    format: PageNumberFormat;
    position: PageNumberPosition;
  };
  watermark: {
    enabled: boolean;
    imageUrl: string;
    opacity: number; // 0..1
    scale: number; // 0..1 of page width
  };
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  footer: { enabled: false, text: "" },
  pageNumber: { enabled: false, format: "page-n-of-total", position: "bottom-center" },
  watermark: { enabled: false, imageUrl: "", opacity: 0.15, scale: 0.6 },
};

const STORAGE_PREFIX = "docpro:pageSettings:";

export function loadPageSettings(docId: string): PageSettings {
  if (typeof window === "undefined") return DEFAULT_PAGE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + docId);
    if (!raw) return DEFAULT_PAGE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PageSettings>;
    return {
      footer: { ...DEFAULT_PAGE_SETTINGS.footer, ...(parsed.footer ?? {}) },
      pageNumber: { ...DEFAULT_PAGE_SETTINGS.pageNumber, ...(parsed.pageNumber ?? {}) },
      watermark: { ...DEFAULT_PAGE_SETTINGS.watermark, ...(parsed.watermark ?? {}) },
    };
  } catch {
    return DEFAULT_PAGE_SETTINGS;
  }
}

export function savePageSettings(docId: string, settings: PageSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + docId, JSON.stringify(settings));
  } catch {
    /* noop */
  }
}

export function formatPageNumber(
  format: PageNumberFormat,
  page: number,
  total: number,
): string {
  switch (format) {
    case "n":
      return String(page);
    case "page-n":
      return `Página ${page}`;
    case "page-n-of-total":
      return `Página ${page} de ${total}`;
    case "dash-n-dash":
      return `— ${page} —`;
  }
}
