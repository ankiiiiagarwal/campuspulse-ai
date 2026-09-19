import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Execute the store's Supabase reads/RPCs against local PostgreSQL, not a fake store. */
export function databaseClient(db: PGlite): SupabaseClient {
  function from(table: string) {
    if (!/^[a-z_]+$/.test(table)) throw new Error("Invalid table");
    let columns = "*", order = "", offset = 0, limit: number | null = null;
    let single = false, optional = false;
    const filters: Array<[string, unknown]> = [];
    const query = {
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { filters.push([key,value]); return query; },
      order(key: string) { order = key; return query; },
      range(start: number, end: number) { offset = start; limit = end-start+1; return query; },
      single() { single = true; return query; },
      maybeSingle() { single = true; optional = true; return query; },
      async then(resolve: (result: {data: unknown; error: unknown}) => unknown) {
        try {
          const where = filters.length ? " where " + filters.map(([key],i) => `"${key}"=$${i+1}`).join(" and ") : "";
          const sql = `select ${columns} from public."${table}"${where}${order ? ` order by "${order}"` : ""}${limit == null ? "" : ` limit ${limit} offset ${offset}`}`;
          const result = await db.query(sql,filters.map(([,value])=>value));
          if (single && (result.rows.length > 1 || (!optional && !result.rows.length))) throw new Error("Expected one row");
          // PostgREST returns JSON timestamp strings, while PGlite returns Dates.
          const rows = JSON.parse(JSON.stringify(result.rows));
          return resolve({data: single ? rows[0] ?? null : rows,error:null});
        } catch (error) { return resolve({data:null,error}); }
      },
    };
    return query;
  }
  return {
    from,
    async rpc(name: string, args: Record<string,unknown>) {
      try {
        if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid RPC");
        const keys = Object.keys(args);
        const sql = `select public.${name}(${keys.map((key,i)=>`${key} => $${i+1}`).join(",")}) as value`;
        const result = await db.query<{value:unknown}>(sql,keys.map(key => typeof args[key] === "object" ? JSON.stringify(args[key]) : args[key]));
        return {data:result.rows[0].value,error:null};
      } catch (error) { return {data:null,error}; }
    },
  } as unknown as SupabaseClient;
}
