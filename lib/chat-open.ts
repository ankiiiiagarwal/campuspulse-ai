export const HELP_CHAT_EVENT = "campuspulse-open-help";

export function openHelpChat(prefill?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HELP_CHAT_EVENT, { detail: { prefill: prefill || "" } }));
}
