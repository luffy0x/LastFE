import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

type FakeLabel = { name: string };

type FakeIssue = {
  number: number;
  title: string;
  body: string;
  labels: FakeLabel[];
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
};

const HOST = "127.0.0.1";
const PORT = 4010;
const issues: FakeIssue[] = [];
let failNextIssueCreate = false;
let revision = 0;

function timestamp(): string {
  revision += 1;
  return new Date(Date.UTC(2026, 8, 2, 0, 0, revision)).toISOString();
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Expected a JSON object");
  }
  return value as Record<string, unknown>;
}

function labelNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((label) => {
    if (typeof label === "string") return [label];
    if (
      label &&
      typeof label === "object" &&
      "name" in label &&
      typeof label.name === "string"
    ) {
      return [label.name];
    }
    return [];
  });
}

function issueNumber(pathname: string): number | null {
  const match = /^\/repos\/[^/]+\/[^/]+\/issues\/(\d+)/.exec(pathname);
  return match ? Number(match[1]) : null;
}

function findIssue(pathname: string): FakeIssue | undefined {
  const number = issueNumber(pathname);
  return number === null
    ? undefined
    : issues.find((issue) => issue.number === number);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

  try {
    if (request.method === "GET" && url.pathname === "/__test/health") {
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && url.pathname === "/__test/reset") {
      issues.length = 0;
      failNextIssueCreate = false;
      revision = 0;
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === "POST" && url.pathname === "/__test/fail-next") {
      failNextIssueCreate = true;
      json(response, 200, { ok: true });
      return;
    }
    if (request.method === "GET" && url.pathname === "/__test/issues/latest") {
      const latest = issues.at(-1);
      json(response, latest ? 200 : 404, latest ?? { message: "No issues" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/__test/issues/count") {
      json(response, 200, { count: issues.length });
      return;
    }
    if (request.method === "PATCH" && /^\/__test\/issues\/\d+$/.test(url.pathname)) {
      const number = Number(url.pathname.split("/").at(-1));
      const issue = issues.find((candidate) => candidate.number === number);
      if (!issue) {
        json(response, 404, { message: "Issue not found" });
        return;
      }
      const input = await readJson(request);
      if (input.labels !== undefined) {
        issue.labels = labelNames(input.labels).map((name) => ({ name }));
      }
      if (input.state === "open" || input.state === "closed") {
        issue.state = input.state;
      }
      if (typeof input.title === "string") issue.title = input.title;
      if (typeof input.body === "string") issue.body = input.body;
      issue.updated_at =
        typeof input.updated_at === "string" ? input.updated_at : timestamp();
      json(response, 200, issue);
      return;
    }
    if (request.method === "POST" && /^\/repos\/[^/]+\/[^/]+\/issues$/.test(url.pathname)) {
      if (failNextIssueCreate) {
        failNextIssueCreate = false;
        json(response, 503, { message: "Test upstream unavailable" });
        return;
      }
      const input = await readJson(request);
      const now = timestamp();
      const issue: FakeIssue = {
        number: issues.length + 1,
        title: String(input.title ?? ""),
        body: String(input.body ?? ""),
        labels: labelNames(input.labels).map((name) => ({ name })),
        state: "open",
        created_at: now,
        updated_at: now,
      };
      issues.push(issue);
      json(response, 201, issue);
      return;
    }

    const issue = findIssue(url.pathname);
    if (!issue) {
      json(response, 404, { message: "Not found" });
      return;
    }
    if (request.method === "GET" && /^\/repos\/[^/]+\/[^/]+\/issues\/\d+$/.test(url.pathname)) {
      json(response, 200, issue);
      return;
    }
    if (request.method === "DELETE" && /\/labels\/[^/]+$/.test(url.pathname)) {
      const name = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      const before = issue.labels.length;
      issue.labels = issue.labels.filter((label) => label.name !== name);
      issue.updated_at = timestamp();
      json(response, before === issue.labels.length ? 404 : 200, issue.labels);
      return;
    }
    if (request.method === "POST" && /\/labels$/.test(url.pathname)) {
      const input = await readJson(request);
      const names = new Set(issue.labels.map(({ name }) => name));
      for (const name of labelNames(input.labels)) names.add(name);
      issue.labels = [...names].map((name) => ({ name }));
      issue.updated_at = timestamp();
      json(response, 200, issue.labels);
      return;
    }
    if (request.method === "PATCH" && /^\/repos\/[^/]+\/[^/]+\/issues\/\d+$/.test(url.pathname)) {
      const input = await readJson(request);
      if (input.state === "open" || input.state === "closed") {
        issue.state = input.state;
      }
      issue.updated_at = timestamp();
      json(response, 200, issue);
      return;
    }

    json(response, 404, { message: "Not found" });
  } catch {
    json(response, 400, { message: "Invalid test request" });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`fake-github listening on http://${HOST}:${PORT}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
