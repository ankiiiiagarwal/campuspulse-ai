import { expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readRows } from "@/lib/database-read";

it("retrieves more than 1000 records even with a smaller server page cap", async () => {
  const rows = Array.from({length:1203}, (_,id)=>({id}));
  const offsets: number[] = [];
  const client = { from: () => ({ select: () => ({ order: () => ({
    range: (start:number) => { offsets.push(start); return Promise.resolve({data:rows.slice(start,start+200),error:null}); },
  }) }) }) } as unknown as SupabaseClient;
  expect(await readRows(client,"issues")).toEqual(rows);
  expect(offsets).toEqual([0,200,400,600,800,1000,1200,1203]);
});
