import { describe, expect, it } from "vitest";

import { parseSubmission } from "@/features/submissions/schemas";

import { decodeIssue, encodeIssue } from "./issue-codec";

const VALID_INTERVIEW = parseSubmission("interview", {
  regionSlug: "interview",
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面"],
  markdown: "面试记录",
});

describe("GitHub submission issue codec", () => {
  it("round-trips user text without sentinel injection", () => {
    const input = { ...VALID_INTERVIEW, markdown: "text --> more text" };
    const encoded = encodeIssue(input);

    expect(
      decodeIssue({
        title: encoded.title,
        body: encoded.body,
        labels: encoded.labels,
      }),
    ).toEqual(input);
  });

  it("uses the complete editable tail as a resource summary", () => {
    const input = parseSubmission("resources", {
      regionSlug: "resources",
      title: "Node.js 文档",
      url: "https://nodejs.org/docs/latest/api/",
      summary: "第一行\n<!-- submission:v1:looks-like-content -->\n最后一行",
      tags: ["文档"],
    });
    const encoded = encodeIssue(input);

    expect(decodeIssue(encoded)).toEqual(input);
  });

  it("rejects malformed or non-leading metadata envelopes", () => {
    const encoded = encodeIssue(VALID_INTERVIEW);

    expect(() =>
      decodeIssue({ ...encoded, body: `prefix\n${encoded.body}` }),
    ).toThrow();
    expect(() =>
      decodeIssue({
        ...encoded,
        body: "<!-- submission:v1:not-base64 -->\n<!-- submission-content -->\ntext",
      }),
    ).toThrow();
    expect(() =>
      decodeIssue({
        ...encoded,
        body: encoded.body.replace(
          "<!-- submission-content -->",
          "<!-- submission-content -->\n<!-- submission:v1:extra -->",
        ),
      }),
    ).not.toThrow();
  });
});
