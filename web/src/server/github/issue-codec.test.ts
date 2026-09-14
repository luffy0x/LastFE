import { describe, expect, it } from "vitest";
import {
  buildSubmissionIssue,
  parseSubmissionIssueBody,
} from "./issue-codec";

describe("submission issue codec", () => {
  it("round-trips a submission through the fixed private issue format", () => {
    const issue = buildSubmissionIssue({
      regionSlug: "projects",
      title: "实时协作编辑器复盘",
      tags: ["CRDT", "React"],
      nickname: "",
      markdown: "## 取舍\n\nCRDT 负责文档合并。",
      externalUrl: "https://github.com/yjs/yjs",
      metadata: { techStack: "React / TypeScript / Yjs" },
    });

    expect(issue.title).toBe("[projects] 实时协作编辑器复盘");
    expect(issue.labels).toEqual(["submission", "pending", "region:projects"]);
    expect(parseSubmissionIssueBody(issue.body)).toMatchObject({
      regionSlug: "projects",
      title: "实时协作编辑器复盘",
      nickname: null,
    });
    expect(issue.body).not.toContain("SUPABASE");
  });

  it("rejects bodies without the signed metadata envelope", () => {
    expect(() => parseSubmissionIssueBody("普通 issue 内容")).toThrow(
      "Issue body does not contain a LastFE submission payload",
    );
  });

  it("still parses when whitespace is injected into the payload", () => {
    const issue = buildSubmissionIssue({
      regionSlug: "fundamentals",
      title: "Redis 持久化",
      tags: ["Redis"],
      nickname: null,
      markdown: "## 区别\n\nRDB 与 AOF。",
      externalUrl: null,
      metadata: { category: "数据库与缓存" },
    });

    const start = issue.body.indexOf("<!-- lastfe-submission:v1");
    const payloadStart = start + "<!-- lastfe-submission:v1".length;
    const end = issue.body.indexOf("-->", payloadStart);
    const encoded = issue.body.slice(payloadStart, end);
    const wrapped = `${encoded.slice(0, 40)}\n${encoded.slice(40, 80)}\n${encoded.slice(80)}`;

    expect(() => parseSubmissionIssueBody(issue.body.replace(encoded, wrapped))).not.toThrow();
  });
});
