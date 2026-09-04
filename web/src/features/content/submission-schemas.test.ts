import { describe, expect, it } from "vitest";
import { parseSubmissionInput } from "./submission-schemas";

describe("parseSubmissionInput", () => {
  it("validates shared and interview-specific fields", () => {
    const submission = parseSubmissionInput({
      regionSlug: "interview",
      title: "字节基础架构一面复盘",
      tags: ["后端", "缓存"],
      nickname: "L",
      markdown: "## 过程\n\n重点聊了 Redis。",
      metadata: {
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
      },
    });

    expect(submission).toMatchObject({
      regionSlug: "interview",
      nickname: "L",
      metadata: {
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
      },
    });
  });

  it("rejects unsafe resource links and unknown regions", () => {
    expect(() =>
      parseSubmissionInput({
        regionSlug: "resources",
        title: "资料",
        tags: ["前端"],
        externalUrl: "javascript:alert(1)",
        metadata: {},
      }),
    ).toThrow("投稿内容不符合要求");

    expect(() =>
      parseSubmissionInput({
        regionSlug: "unknown",
        title: "资料",
        tags: ["前端"],
        metadata: {},
      }),
    ).toThrow("投稿内容不符合要求");
  });
});
