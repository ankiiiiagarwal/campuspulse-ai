import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { reportCoordinates } from "@/lib/client";
import { readJson } from "@/lib/request-body";

const auth = vi.hoisted(() => ({
  jar: new Map<string, string>(), remote: vi.fn(), remoteEnabled: false,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (key: string) => auth.jar.has(key) ? { value: auth.jar.get(key) } : undefined,
  set: (key: string, value: string) => auth.jar.set(key, value),
  delete: (key: string) => auth.jar.delete(key),
}) }));
vi.mock("@/lib/supabase", () => ({
  hasSupabase: () => false,
  hasSupabaseAnon: () => auth.remoteEnabled,
  supabaseAnon: () => ({ auth: { signInWithPassword: auth.remote } }),
}));

beforeEach(async () => {
  vi.resetModules(); auth.jar.clear(); auth.remote.mockReset(); auth.remoteEnabled = false;
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("ADMIN_EMAIL", "admin@campus.local"); vi.stubEnv("ADMIN_PASSWORD", "campuspulse");
  vi.stubEnv("DEPT_PASSWORD", "campuspulse"); vi.stubEnv("DEPT_IT_PASSWORD", "");
  const dir = await mkdtemp(path.join(tmpdir(), "campuspulse-security-"));
  vi.spyOn(process, "cwd").mockReturnValue(dir);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("staff authentication", () => {
  it("rejects an unknown user even if Supabase would accept their password", async () => {
    auth.remoteEnabled = true; auth.remote.mockResolvedValue({ error: null });
    const { loginStaff, staffFromEmail } = await import("@/lib/auth");
    expect(staffFromEmail("student@example.test")).toBeNull();
    expect((await loginStaff("student@example.test", "password", "admin")).ok).toBe(false);
    expect(auth.remote).not.toHaveBeenCalled(); expect(auth.jar.size).toBe(0);
  });
  it("allows configured staff and blocks department access to admin", async () => {
    const { loginStaff } = await import("@/lib/auth");
    expect((await loginStaff("it@campus.local", "campuspulse", "admin")).ok).toBe(false);
    expect((await loginStaff("admin@campus.local", "campuspulse", "admin")).ok).toBe(true);
    expect(auth.jar.get("cp_admin")).toBeTruthy();
  });
  it("revokes existing sessions and Supabase's old password after rotation", async () => {
    const { loginStaff, getDeptSession } = await import("@/lib/auth");
    const { setDeptPasswordOverride } = await import("@/lib/dept-secrets");
    expect((await loginStaff("it@campus.local", "campuspulse", "department")).ok).toBe(true);
    expect(await getDeptSession()).not.toBeNull();
    await setDeptPasswordOverride("it", "new-password-123", "admin@campus.local");
    expect(await getDeptSession()).toBeNull();
    auth.remoteEnabled = true; auth.remote.mockResolvedValue({ error: null });
    expect((await loginStaff("it@campus.local", "campuspulse", "department")).ok).toBe(false);
    expect((await loginStaff("it@campus.local", "new-password-123", "department")).ok).toBe(true);
    expect(auth.remote).not.toHaveBeenCalled();
  });
});

it("rejects default secrets on self-hosted production", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("ADMIN_SESSION_SECRET", "");
  const { sessionSecret } = await import("@/lib/secrets");
  expect(() => sessionSecret()).toThrow("ADMIN_SESSION_SECRET");
  vi.stubEnv("ADMIN_SESSION_SECRET", "a-long-random-test-secret-of-32-characters");
  expect(() => sessionSecret()).toThrow("ADMIN_PASSWORD");
  vi.stubEnv("ADMIN_PASSWORD", "production-admin-password");
  expect(sessionSecret()).toContain("a-long-random");
});

describe("photos", () => {
  it("decodes an upload and reads the existing photo", async () => {
    const { savePhoto, readPhoto } = await import("@/lib/upload");
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const url = await savePhoto(`data:image/png;base64,${png.toString("base64")}`, "report");
    expect(url).toMatch(/^\/uploads\/report-.*\.jpg$/);
    expect((await readPhoto(url, "report")).mime).toBe("image/jpeg");
    await expect(readPhoto(url, "resolve")).rejects.toThrow("uploaded");
  });
  it("rejects fake, corrupt and arbitrary URLs without network requests", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { savePhoto, readPhoto } = await import("@/lib/upload");
    const { describeReportPhoto } = await import("@/lib/vision");
    for (const url of ["fake", "http://127.0.0.1/private", "https://example.test/photo.jpg", "/uploads/../secret"]) {
      await expect(readPhoto(url)).rejects.toThrow();
      await expect(describeReportPhoto(url)).rejects.toThrow();
    }
    await expect(savePhoto("data:image/png;base64,ZmFrZQ==", "report")).rejects.toThrow();
    await expect(savePhoto("data:image/svg+xml;base64,PHN2Zz4=", "report")).rejects.toThrow();
    const name = "report-123-12345678.jpg";
    await mkdir(path.join(process.cwd(), "public/uploads"), { recursive: true });
    await writeFile(path.join(process.cwd(), "public/uploads", name), "not an image");
    await expect(readPhoto(`/uploads/${name}`)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

it("does not invent coordinates when opening the report page", () => {
  for (const query of ["", "lat=12", "lat=&lng=", "lat=NaN&lng=2", "lat=91&lng=2"]) {
    expect(reportCoordinates(new URLSearchParams(query))).toBeNull();
  }
  expect(reportCoordinates(new URLSearchParams("lat=0&lng=0"))).toEqual({ lat: 0, lng: 0 });
});

it("limits streamed request bytes even without Content-Length", async () => {
  const request = new Request("http://localhost", { method: "POST", body: JSON.stringify({ value: "x".repeat(100) }) });
  await expect(readJson(request, 20)).rejects.toMatchObject({ status: 413 });
  await expect(readJson(new Request("http://localhost", { method: "POST", body: "null" }))).rejects.toMatchObject({ status: 400 });
});
