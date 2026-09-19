import path from "path";

/** Demo data is isolated and can never switch a production deployment's storage. */
export function isDemoMode() {
  return process.env.NODE_ENV === "development" && process.env.CAMPUSPULSE_DEMO === "1";
}

export function localDataFile(name: string) {
  return path.join(process.cwd(), isDemoMode() ? ".data-demo" : ".data", name);
}
