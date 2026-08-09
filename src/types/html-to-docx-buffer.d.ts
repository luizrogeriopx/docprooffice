declare module "html-to-docx-buffer" {
  export default function htmlToDocx(
    html: string,
    headerHtml?: string,
    options?: Record<string, unknown>,
  ): Promise<Uint8Array>;
}