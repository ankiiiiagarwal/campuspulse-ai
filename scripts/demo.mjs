import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env, CAMPUSPULSE_DEMO: "1", USE_LOCAL_DB: "1",
  ADMIN_EMAIL: "admin@campus.local", ADMIN_PASSWORD: "campuspulse-demo",
  DEPT_PASSWORD: "campuspulse-demo", ADMIN_SESSION_SECRET: randomBytes(32).toString("hex") };
for (const dept of ["IT", "HOSTEL", "MESS", "CAMPUS", "LIBRARY"]) {
  env[`DEPT_${dept}_PASSWORD`] = "campuspulse-demo";
  env[`DEPT_${dept}_EMAIL`] = `${dept.toLowerCase()}@campus.local`;
}
console.log("CampusPulse demo: http://localhost:3000 — isolated sample data in .data-demo");
console.log("Demo staff password: campuspulse-demo (see /demo for accounts and walkthrough)");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"], {cwd:root, env, stdio:"inherit"});
child.on("exit", code => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
