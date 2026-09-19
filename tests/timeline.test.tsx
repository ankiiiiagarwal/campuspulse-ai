import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TicketTimeline } from "@/components/TicketTimeline";
import { buildSeed } from "@/lib/seed-data";
it("never presents a future completion estimate as an actual work-start event",()=>{
  const issue={...buildSeed().issues[0],title:"Lights down",report_count:1,me_too_count:0,is_recurring:false,status:"resolved" as const,worker_name:"Worker",eta_at:"2099-12-31T12:00:00Z"};
  const html=renderToStaticMarkup(<TicketTimeline issue={issue} labels={{reported:"Reported",assigned:"Assigned",onIt:"Work started",resolved:"Resolved",waiting:"Waiting"}} />);
  expect(html).not.toContain("2099");
  expect(html).toContain("Start time was not recorded");
});
