"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

export function PrintPosterButton({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  const { lang, t } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function printPoster() {
    setBusy(true);
    setError("");
    let frame: HTMLIFrameElement | undefined;
    try {
      const QRCode = await import("qrcode");
      const qr = await QRCode.toDataURL(href, { width: 900, margin: 2, errorCorrectionLevel: "M" });
      // A separate document contains exactly one poster, never the surrounding app.
      frame = document.createElement("iframe");
      frame.title = `Print poster: ${title}`;
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:1100px;border:0;";
      document.body.appendChild(frame);
      const doc = frame.contentDocument;
      const printWindow = frame.contentWindow;
      if (!doc || !printWindow) throw new Error("Print preview unavailable");
      doc.title = `CampusPulse — ${title}`;
      doc.documentElement.lang = lang;
      const style = doc.createElement("style");
      style.textContent = `
        @page { size: A4 portrait; margin: 18mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #123d35; background: white; font-family: Arial, 'Nirmala UI', sans-serif; }
        article { padding: 14mm 8mm; border: 2px solid #123d35; border-radius: 8mm; text-align: center; break-inside: avoid; }
        .brand { font-size: 15pt; font-weight: bold; letter-spacing: 1px; }
        h1 { margin: 10mm 0 4mm; font-size: 28pt; line-height: 1.2; overflow-wrap: anywhere; }
        p { margin: 4mm 0; font-size: 14pt; line-height: 1.5; }
        img { display: block; width: 70mm; height: 70mm; margin: 8mm auto; }
        .url { margin-top: 8mm; font-size: 9pt; color: #40524e; overflow-wrap: anywhere; }
      `;
      doc.head.appendChild(style);
      const poster = doc.createElement("article");
      const text = (tag: string, value: string, className = "") => {
        const element = doc.createElement(tag);
        element.textContent = value;
        element.className = className;
        poster.appendChild(element);
      };
      text("p", "CampusPulse", "brand");
      text("h1", title);
      if (subtitle) text("p", subtitle);
      const image = doc.createElement("img");
      image.alt = t("posterHint");
      image.src = qr;
      poster.appendChild(image);
      text("p", t("posterHint"));
      text("p", href, "url");
      doc.body.appendChild(poster);
      await image.decode();
      await doc.fonts.ready;
      const printedFrame = frame;
      const cleanup = () => printedFrame.remove();
      const expiry = window.setTimeout(cleanup, 300000);
      printWindow.addEventListener("afterprint", () => { window.clearTimeout(expiry); cleanup(); }, { once: true });
      printWindow.focus();
      printWindow.print();
    } catch {
      frame?.remove();
      setError(lang === "hi" ? "प्रिंट नहीं खुला। दोबारा कोशिश करें।" : "Could not open print preview. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={() => void printPoster()} disabled={busy || !href}
      aria-label={`${t("printPoster")}: ${title}`}
      className="rounded-full border border-rule px-4 py-2 text-sm font-semibold disabled:opacity-50 print:hidden">
      {busy ? (lang === "hi" ? "तैयार हो रहा है…" : "Preparing…") : t("printPoster")}
    </button>
    {error && <span role="alert" className="text-sm text-critical print:hidden">{error}</span>}
  </>;
}
