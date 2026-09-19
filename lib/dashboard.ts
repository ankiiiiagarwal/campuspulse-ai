/** Load all dashboard sections before publishing a new, internally complete view. */
export async function fetchDashboard() {
  const responses = await Promise.all([
    fetch("/api/issues", { cache: "no-store", signal: AbortSignal.timeout(20000) }),
    fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(20000) }),
    fetch("/api/campus", { cache: "no-store", signal: AbortSignal.timeout(20000) }),
  ]);
  const data = await Promise.all(responses.map(response => response.json().catch(() => ({error:"The local server did not return data. Please retry."}))));
  for (let index = 0; index < responses.length; index++) {
    if (!responses[index].ok) throw new Error(data[index]?.error || "Could not load dashboard. Please retry.");
  }
  if (!data[1]?.campus || !Number.isFinite(data[1].campus.score)) throw new Error("Campus health is unavailable. Please retry.");
  return { inventory: data[0], health: data[1], boundary: data[2].boundary || null };
}
