import type { Editor } from "@tiptap/core";
import { runPaginationEngine } from "./engine";
import { paginationBreaksSignature, setPaginationBreaks } from "./renderer";
import type { PageDimensions } from "./types";

export interface SchedulerConfig {
  editor: Editor;
  contentEl: HTMLElement;
  pageHeight: number;
  scale: number;
  abntMode: string;
  layoutMode: string;
  onPageCountChange: (count: number) => void;
}

export class PaginationScheduler {
  private config: SchedulerConfig;
  private isPaginating = false;
  private currentVersion = 0;

  private lastDocSignature = "";
  private lastHeightWithWidgets = 0;
  private previousSignature = "";

  private debounceTimeout: any = null;
  private animationFrame: number | null = null;
  private safetyInitTimeout: any = null;

  private resizeObserver: ResizeObserver | null = null;
  
  private handleEditorUpdate = () => {
    this.schedule(false);
  };

  private handleImageLoad = (e: Event) => {
    if ((e.target as HTMLElement)?.tagName === "IMG") {
      this.schedule(true);
    }
  };

  private handleVisibilityChange = () => {
    if (typeof document !== "undefined" && !document.hidden) {
      const prose = this.config.contentEl.querySelector<HTMLElement>(".ProseMirror");
      if (!prose) return;

      const currentHeight = prose.scrollHeight;
      const docSignature = this.getDocSignature();
      const sigChanged = docSignature !== this.lastDocSignature;
      const heightChanged = Math.abs(currentHeight - this.lastHeightWithWidgets) > 2;

      if (sigChanged || heightChanged) {
        this.schedule(true);
      }
    }
  };

  private handleFontsLoaded = () => {
    // Allow the browser to complete a layout reflow after font loading before measuring
    setTimeout(() => {
      this.schedule(true);
    }, 50);
  };

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  public updateConfig(newConfig: Partial<SchedulerConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.schedule(true);
  }

  private getDocSignature(): string {
    const { editor, abntMode, scale, layoutMode } = this.config;
    return `${editor.state.doc.content.size}:${editor.state.doc.childCount}:${abntMode}:${scale}:${layoutMode}`;
  }

  public schedule(force = false) {
    if (this.isPaginating) return;

    const prose = this.config.contentEl.querySelector<HTMLElement>(".ProseMirror");
    if (!prose) return;

    const currentHeight = prose.scrollHeight;
    const docSignature = this.getDocSignature();

    const sigChanged = docSignature !== this.lastDocSignature;
    const heightChanged = Math.abs(currentHeight - this.lastHeightWithWidgets) > 2;

    if (!force && !sigChanged && !heightChanged) return;

    if (sigChanged) {
      this.lastDocSignature = docSignature;
    }

    if (this.debounceTimeout !== null) clearTimeout(this.debounceTimeout);
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);

    const version = ++this.currentVersion;

    this.debounceTimeout = setTimeout(() => {
      this.animationFrame = requestAnimationFrame(() => {
        if (version !== this.currentVersion) return;
        this.runLayout();
      });
    }, 100);
  }

  private runLayout() {
    this.isPaginating = true;
    const prose = this.config.contentEl.querySelector<HTMLElement>(".ProseMirror");
    if (!prose || prose.offsetWidth === 0 || prose.offsetHeight === 0) {
      this.isPaginating = false;
      return;
    }

    try {
      const styles = window.getComputedStyle(this.config.contentEl);
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;

      const result = runPaginationEngine(
        this.config.editor.view,
        prose,
        this.config.pageHeight,
        paddingTop,
        paddingBottom,
        this.config.scale,
        this.config.abntMode,
        this.config.layoutMode
      );

      const signature = paginationBreaksSignature(result.breaks);
      if (signature !== this.previousSignature) {
        this.previousSignature = signature;
        setPaginationBreaks(this.config.editor.view, result.breaks);
      }

      this.lastHeightWithWidgets = prose.scrollHeight;
      this.config.onPageCountChange(result.pageCount);
    } catch (err) {
      console.error("Pagination layout run failed:", err);
    } finally {
      this.isPaginating = false;
    }
  }

  public start() {
    const { editor, contentEl } = this.config;

    // Listeners for Tiptap editor changes
    editor.on("update", this.handleEditorUpdate);
    editor.on("transaction", this.handleEditorUpdate);

    // ResizeObserver setup
    this.resizeObserver = new ResizeObserver(() => this.schedule(false));
    this.resizeObserver.observe(contentEl);
    const proseEl = contentEl.querySelector<HTMLElement>(".ProseMirror");
    if (proseEl) {
      this.resizeObserver.observe(proseEl);
    }

    // Image loading capturer
    contentEl.addEventListener("load", this.handleImageLoad, true);

    // Tab visibility changer
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("focus", this.handleVisibilityChange);

    // Fonts loading done promise and events
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.addEventListener("loadingdone", this.handleFontsLoaded);
      document.fonts.ready.then(this.handleFontsLoaded);
    }

    // 300ms Safety initializer fallback
    this.safetyInitTimeout = setTimeout(() => {
      this.schedule(true);
    }, 300);

    // Run first pagination
    this.schedule(true);
  }

  public destroy() {
    const { editor, contentEl } = this.config;

    editor.off("update", this.handleEditorUpdate);
    editor.off("transaction", this.handleEditorUpdate);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    contentEl.removeEventListener("load", this.handleImageLoad, true);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("focus", this.handleVisibilityChange);

    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.removeEventListener("loadingdone", this.handleFontsLoaded);
    }

    if (this.debounceTimeout !== null) clearTimeout(this.debounceTimeout);
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    if (this.safetyInitTimeout !== null) clearTimeout(this.safetyInitTimeout);
  }
}
