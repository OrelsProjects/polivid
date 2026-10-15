export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startProductionTicker } = await import("./lib/production/jobs/runner");
  startProductionTicker();
}
