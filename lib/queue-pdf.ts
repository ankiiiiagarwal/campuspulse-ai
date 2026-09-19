import { formatDateTime } from "@/lib/client";
import { formatExpectedBy } from "@/lib/eta";
import { isOverdue } from "@/lib/scoring";
import type { IssueWithCluster } from "@/lib/types";

function peopleCount(issue: IssueWithCluster): number {
  return issue.report_count + issue.me_too_count;
}

function statusForPdf(issue: IssueWithCluster): string {
  if (issue.status === "open") return "Unassigned";
  if (issue.status === "assigned") return "Assigned — not started";
  if (issue.status === "on_it") return issue.worker_name ? `On it · ${issue.worker_name}` : "On it";
  return "Closed";
}

function fileDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Browser text shaping preserves Hindi conjuncts, which the built-in PDF font cannot encode. */
function shapedCell(text: string, width: number): { image: string; height: number } {
  const scale = 3, font = 8, lineHeight = 12;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF export requires canvas support");
  ctx.font = `${font}px sans-serif`;
  const lines: string[] = [];
  let line = "";
  const parts = text.split(/\s+/);
  for (const word of parts) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) { line = next; continue; }
    if (line) lines.push(line);
    line = "";
    const segments = new Intl.Segmenter(undefined, {granularity:"grapheme"}).segment(word);
    for (const {segment} of segments) {
      if (line && ctx.measureText(line+segment).width > width) { lines.push(line); line=""; }
      line += segment;
    }
  }
  if (line) lines.push(line);
  const height = Math.max(lineHeight, lines.length * lineHeight);
  canvas.width = Math.ceil(width*scale); canvas.height = height*scale;
  ctx.scale(scale,scale); ctx.font = `${font}px sans-serif`; ctx.fillStyle = "#18332f"; ctx.textBaseline = "top";
  lines.forEach((l,i)=>ctx.fillText(l,0,i*lineHeight+1));
  return {image:canvas.toDataURL("image/png"),height};
}

export async function downloadQueuePdf(
  rows: IssueWithCluster[],
  opts: { title: string; filenameStem: string; note?: string },
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const printed = new Date().toLocaleString();
  await document.fonts.ready;
  // Total 762 points: exactly the printable width of landscape A4 with 40pt margins.
  const widths = [80,160,90,50,95,42,85,110,50];
  const shaped = new Map<string, ReturnType<typeof shapedCell>>();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 42, 58);
  doc.text(opts.title, 40, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(91, 83, 72);
  const subtitle = [opts.note, `${rows.length} tickets`, printed].filter(Boolean).join(" · ");
  doc.text(subtitle, 40, 54);

  autoTable(doc, {
    startY: 70,
    head: [["Ticket", "Title", "Place", "Dept", "Status", "People", "Opened", "Expected by", "Overdue"]],
    body: rows.map((i) => [
      i.ticket_code,
      i.title,
      i.building,
      i.department,
      statusForPdf(i),
      String(peopleCount(i)),
      formatDateTime(i.created_at),
      i.eta_at && i.status !== "resolved" ? formatExpectedBy(i.eta_at) : "—",
      isOverdue(i) ? "Yes" : "",
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: [30, 42, 58], overflow: "linebreak" },
    headStyles: { fillColor: [18, 61, 53], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 246] },
    columnStyles: Object.fromEntries(widths.map((cellWidth,i)=>[i,{cellWidth}])),
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      if (data.section === "body" && /[^\u0000-\u024f\u2000-\u206f]/.test(String(data.cell.raw ?? ""))) {
        const text = String(data.cell.raw);
        const key = `${data.row.index}:${data.column.index}`;
        const rendered = shapedCell(text, widths[data.column.index]-10);
        shaped.set(key,rendered); data.cell.text = [""]; data.cell.styles.minCellHeight = rendered.height+10;
      }
      if (data.section === "body" && data.column.index === 8 && data.cell.raw === "Yes") {
        data.cell.styles.textColor = [196, 56, 40];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: data => {
      if (data.section !== "body") return;
      const rendered = shaped.get(`${data.row.index}:${data.column.index}`);
      if (rendered) doc.addImage(rendered.image,"PNG",data.cell.x+5,data.cell.y+5,data.cell.width-10,rendered.height);
    },
  });

  doc.save(`campuspulse-${opts.filenameStem}-${fileDay()}.pdf`);
}
