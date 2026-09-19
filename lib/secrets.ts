const WEAK_SECRETS = new Set([
  "",
  "change-me-before-deploy",
  "campuspulse-local-dev-only",
  "campuspulse",
  "secret",
  "changeme",
]);

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/** Fail closed in production so a missing env var cannot mint admin cookies. */
export function assertProductionSecrets(): void {
  if (!isProductionRuntime()) return;

  const secret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (WEAK_SECRETS.has(secret) || secret.length < 24) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be a long random value in production (24+ characters, not the sample from .env.local.example).",
    );
  }

  const password = (process.env.ADMIN_PASSWORD || "").trim();
  if (!password || password === "campuspulse") {
    throw new Error("ADMIN_PASSWORD must be set and must not be the shipped default in production.");
  }
}

export function sessionSecret(): string {
  assertProductionSecrets();
  const secret = (process.env.ADMIN_SESSION_SECRET || "").trim();
  if (secret) return secret;
  return "campuspulse-local-dev-only";
}
