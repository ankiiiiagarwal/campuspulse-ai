import type { Status } from "./types";

export const STATUSES: Status[] = ["open", "assigned", "on_it", "resolved"];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as string[]).includes(value);
}
