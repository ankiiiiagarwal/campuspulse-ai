import { formatDateTime } from "@/lib/client";
import { formatExpectedBy } from "@/lib/eta";
import { isOverdue } from "@/lib/scoring";
import type { IssueWithCluster } from "@/lib/types";

function csvCell(value: string): string {
  // User-authored descriptions must stay text when opened in a spreadsheet.
  if (/^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)) value = `'${value}`;
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function statusForCsv(issue: IssueWithCluster): string {
  if (issue.status === "open") return "Unassigned";
  if (issue.status === "assigned") return "Assigned — not started";
  if (issue.status === "on_it") return issue.worker_name ? `On it · ${issue.worker_name}` : "On it";
  return "Closed";
}

export function downloadQueueCsv(
  rows: IssueWithCluster[],
  opts: { filenameStem: string },
) {
  const header = [
    "Ticket",
    "Title",
    "Description",
    "Place",
    "Department",
    "Status",
    "People",
    "Priority",
    "Opened",
    "Expected by",
    "Overdue",
    "Worker",
  ];
  const body = rows.map((i) =>
    [
      i.ticket_code,
      i.title,
      i.description,
      i.building,
      i.department,
      statusForCsv(i),
      String(i.report_count + i.me_too_count),
      String(Number(i.priority).toFixed(1)),
      formatDateTime(i.created_at),
      i.eta_at && i.status !== "resolved" ? formatExpectedBy(i.eta_at) : "",
      isOverdue(i) ? "Yes" : "",
      i.worker_name || "",
    ].map((cell) => csvCell(String(cell ?? ""))),
  );
  const csv = [header, ...body].map((line) => line.join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campuspulse-${opts.filenameStem}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
