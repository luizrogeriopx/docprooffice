import { formatPageNumber, type PageSettings } from "./pageSettings";

interface Props {
  settings: PageSettings;
  pageCount: number;
  pageStride: number;
  pageHeight: number;
  pageWidth: number;
  marginX: number;
  marginY: number;
}

export function PageOverlays({
  settings,
  pageCount,
  pageStride,
  pageHeight,
  pageWidth,
  marginX,
  marginY,
}: Props) {
  const items: React.ReactNode[] = [];

  for (let i = 0; i < pageCount; i++) {
    const top = i * pageStride;
    const pageNum = i + 1;

    // Watermark
    if (settings.watermark.enabled && settings.watermark.imageUrl) {
      const wmSize = pageWidth * settings.watermark.scale;
      items.push(
        <div
          key={`wm-${i}`}
          className="pointer-events-none absolute"
          style={{
            top,
            left: 0,
            width: pageWidth,
            height: pageHeight,
            display: "grid",
            placeItems: "center",
            opacity: settings.watermark.opacity,
          }}
        >
          <img
            src={settings.watermark.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              maxWidth: wmSize,
              maxHeight: pageHeight * settings.watermark.scale,
              objectFit: "contain",
            }}
          />
        </div>,
      );
    }

    // Footer text (kept above page numbering when both are enabled)
    if (settings.footer.enabled && settings.footer.text) {
      const footerOffset = settings.pageNumber.enabled ? 24 : 8;
      items.push(
        <div
          key={`ft-${i}`}
          className="pointer-events-none absolute text-center text-[10pt] text-muted-foreground"
          style={{
            top: top + pageHeight - marginY / 2 - footerOffset,
            left: marginX,
            width: pageWidth - marginX * 2,
            lineHeight: 1.2,
            color: "oklch(0.4 0.01 260)",
          }}
        >
          {settings.footer.text}
        </div>,
      );
    }

    // Page number
    if (settings.pageNumber.enabled) {
      const text = formatPageNumber(settings.pageNumber.format, pageNum, pageCount);
      const pos = settings.pageNumber.position;
      const isTop = pos.startsWith("top");
      const isLeft = pos.endsWith("left");
      const isRight = pos.endsWith("right");

      const verticalOffset = isTop ? marginY / 2 - 8 : pageHeight - marginY / 2 - 6;
      const textAlign: React.CSSProperties["textAlign"] = isLeft
        ? "left"
        : isRight
          ? "right"
          : "center";

      items.push(
        <div
          key={`pn-${i}`}
          className="pointer-events-none absolute text-[10pt]"
          style={{
            top: top + verticalOffset,
            left: marginX,
            width: pageWidth - marginX * 2,
            textAlign,
            lineHeight: 1.2,
            color: "oklch(0.4 0.01 260)",
          }}
        >
          {text}
        </div>,
      );
    }
  }

  return <>{items}</>;
}
