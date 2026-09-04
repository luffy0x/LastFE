const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 4_000);

try {
  const response = await fetch("http://127.0.0.1:3000/api/health", {
    signal: controller.signal,
  });
  const body = await response.json();
  if (!response.ok || body.status !== "ok") process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
