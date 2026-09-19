import { afterEach, expect, it, vi } from "vitest";
import { downloadQueueCsv } from "@/lib/queue-csv";
import { buildSeed } from "@/lib/seed-data";
afterEach(()=>vi.unstubAllGlobals());
it("exports actual ticket fields, quotes commas and prevents spreadsheet formulas",async()=>{
  let blob:Blob|undefined;
  const anchor={href:"",download:"",click:vi.fn()};
  vi.stubGlobal("document",{createElement:()=>anchor});
  vi.stubGlobal("URL",{createObjectURL:(value:Blob)=>{blob=value;return "blob:export";},revokeObjectURL:vi.fn()});
  const base=buildSeed();
  downloadQueueCsv([{...base.issues[0],title:'=SUM(1,2)',description:'Pipe, "leaking"',report_count:2,me_too_count:3,is_recurring:false}],{filenameStem:"campus"});
  const text=await blob!.text();
  expect(text).toContain(`"'=SUM(1,2)"`);
  expect(text).toContain('"Pipe, ""leaking"""');
  expect(text).toContain(base.issues[0].ticket_code);
  expect(anchor.click).toHaveBeenCalledOnce();
  expect(anchor.download).toMatch(/\.csv$/);
});
