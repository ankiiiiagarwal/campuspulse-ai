"use client";

import { useState } from "react";

export function CopyTicket({
  code,
  label,
  copiedLabel,
}: {
  code: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-full border border-rule px-3 py-1.5 text-sm font-semibold"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
