import { rename } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

/** Windows can briefly hold a read handle during simultaneous dashboard requests. */
export async function replaceFile(source: string, target: string) {
  for (let attempt = 0; ; attempt++) {
    try { await rename(source, target); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || !["EPERM", "EACCES", "EBUSY"].includes(code || "") || attempt >= 6) throw error;
      await setTimeout(25 * (attempt + 1));
    }
  }
}
