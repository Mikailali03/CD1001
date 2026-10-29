import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** The URL a printed label encodes: the app's public scan landing page. */
export function assetScanUrl(assetId: string): string {
  return `${window.location.origin}${BASE}/a/${assetId}`;
}

export type QrLabelData = {
  assetId: string;
  name: string;
  category: string;
  registryId: string;
  protocol: string;
};

/** Renders a QR code for `value` as a crisp, print-friendly SVG image. */
export function QrCodeImage({ value, className, alt }: { value: string; className?: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
      .then((svg) => {
        if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) return <div className={cn("bg-gray-100", className)} aria-hidden />;
  return <img src={src} alt={alt} className={className} />;
}

/**
 * One 2.625" × 1" label (Avery 5160 / 8160 size): QR on the left, the
 * human-readable identity on the right, and the spec's CDA protocol string in
 * small print so the label still identifies the unit if the QR is damaged.
 */
export function QrLabel({ label, scanHint }: { label: QrLabelData; scanHint: string }) {
  return (
    <div className="qr-label flex items-center gap-[0.08in] overflow-hidden bg-white text-black px-[0.1in] py-[0.07in]">
      <QrCodeImage
        value={assetScanUrl(label.assetId)}
        alt={label.registryId}
        className="h-[0.84in] w-[0.84in] shrink-0"
      />
      <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
        <p className="font-mono font-bold text-[9pt] tracking-wide">{label.registryId}</p>
        <p className="font-semibold text-[7.5pt] line-clamp-2 break-words">{label.name}</p>
        <p className="text-[6.5pt] uppercase tracking-wider text-gray-600">{label.category}</p>
        <p className="text-[5.5pt] text-gray-600 mt-[1pt]">{scanHint}</p>
        <p className="font-mono text-[4.5pt] text-gray-500 break-all leading-[1.15]">{label.protocol}</p>
      </div>
    </div>
  );
}
