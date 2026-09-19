import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== PREFIX || !salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const a = Buffer.from(hash, "hex");
  if (a.length !== next.length) return false;
  return timingSafeEqual(a, next);
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 72) return "Keep the password under 72 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Use letters and at least one number.";
  }
  return null;
}
