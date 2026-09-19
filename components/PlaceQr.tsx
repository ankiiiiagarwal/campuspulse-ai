"use client";

import { useEffect, useState } from "react";

export function PlaceQr({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let gone = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" }))
      .then((url) => {
        if (!gone) setSrc(url);
      })
      .catch(() => {
        if (!gone) setSrc("");
      });
    return () => {
      gone = true;
    };
  }, [value, size]);

  if (!src) {
    return <div className="flex h-[180px] w-[180px] items-center justify-center bg-paper text-xs text-ink/50">QR…</div>;
  }
  return <img src={src} width={size} height={size} alt={value} className="h-auto w-full max-w-[180px] bg-white" />;
}
