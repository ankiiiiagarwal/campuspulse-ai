import type { SupabaseClient } from "@supabase/supabase-js";

/** Keep requesting pages even when the server caps a page below our requested size. */
export async function readRows(client: SupabaseClient, table: string, filter?: [string, string]) {
  const rows: Record<string, unknown>[] = [];
  for (;;) {
    let query = client.from(table).select("*").order("id").range(rows.length, rows.length + 499);
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}
