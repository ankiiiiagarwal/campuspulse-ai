"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function ConfirmCard({
  title,
  body,
  confirmLabel,
  busy,
  confirmDisabled,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = panelRef.current;

    function focusables() {
      return Array.from(
        root?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])") ||
          [],
      ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true");
    }

    focusables()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancelRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-navy/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="cp-chat-enter max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-rule bg-white p-5 shadow-card"
      >
        <h3 id={titleId} className="font-serif text-2xl text-navy">
          {title}
        </h3>
        <p id={bodyId} className="mt-2 text-sm text-ink/70">
          {body}
        </p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-rule px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
            className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
