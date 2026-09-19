export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertProductionSecrets } = await import("./lib/secrets");
  assertProductionSecrets();
}
