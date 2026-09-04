import { parseSubmissionInput } from "@/features/content/submission-schemas";

const PAYLOAD_START = "<!-- lastfe-submission:v1";
const PAYLOAD_END = "-->";

type SubmissionIssue = {
  title: string;
  body: string;
  labels: readonly string[];
};

function encodePayload(input: ReturnType<typeof parseSubmissionInput>): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodePayload(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

export function buildSubmissionIssue(input: unknown): SubmissionIssue {
  const submission = parseSubmissionInput(input);
  const markdown = submission.markdown ?? submission.summary ?? "";
  const nickname = submission.nickname ?? "匿名";

  return {
    title: `[${submission.regionSlug}] ${submission.title}`,
    labels: ["submission", "pending", `region:${submission.regionSlug}`],
    body: [
      `${PAYLOAD_START}`,
      encodePayload(submission),
      PAYLOAD_END,
      "",
      `# ${submission.title}`,
      "",
      `投稿者：${nickname}`,
      "",
      markdown,
    ].join("\n"),
  };
}

export function parseSubmissionIssueBody(
  body: string,
): ReturnType<typeof parseSubmissionInput> {
  const start = body.indexOf(PAYLOAD_START);
  if (start === -1) {
    throw new Error("Issue body does not contain a LastFE submission payload");
  }

  const payloadStart = start + PAYLOAD_START.length;
  const end = body.indexOf(PAYLOAD_END, payloadStart);
  if (end === -1) {
    throw new Error("Issue body does not contain a LastFE submission payload");
  }

  const encoded = body.slice(payloadStart, end).trim();
  return parseSubmissionInput(decodePayload(encoded));
}
