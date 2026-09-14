import { describe, expect, it } from "vitest";
import {
  buildInterviewTags,
  buildInterviewTitle,
  parseSubmissionInput,
} from "./submission-schemas";

describe("parseSubmissionInput", () => {
  it("validates shared and interview-specific fields", () => {
    const submission = parseSubmissionInput({
      regionSlug: "interview",
      title: "字节跳动 · 后端开发 · 一面",
      tags: ["后端", "缓存"],
      nickname: "L",
      markdown: "## 过程\n\n重点聊了 Redis。",
      metadata: {
        company: "字节跳动",
        position: "后端开发",
        round: "一面",
      },
    });

    expect(submission).toMatchObject({
      regionSlug: "interview",
      nickname: "L",
      metadata: {
        company: "字节跳动",
        position: "后端开发",
        round: "一面",
      },
    });
  });

  it("accepts interview submissions without tags so the form can auto-derive them", () => {
    const submission = parseSubmissionInput({
      regionSlug: "interview",
      title: "腾讯 · 后端开发 · 二面",
      tags: [],
      markdown: "## 过程\n\n聊网络。",
      metadata: {
        company: "腾讯",
        position: "后端开发",
        round: "二面",
        interviewDate: "2026-09",
      },
    });

    expect(submission.tags).toEqual([]);
  });

  it("rejects interview submissions missing required metadata", () => {
    expect(() =>
      parseSubmissionInput({
        regionSlug: "interview",
        title: "缺公司",
        tags: ["后端"],
        markdown: "## 过程",
        metadata: { position: "后端开发", round: "一面" },
      }),
    ).toThrow("投稿内容不符合要求");
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

describe("interview helpers", () => {
  it("builds the title from company, position and round", () => {
    expect(
      buildInterviewTitle({
        company: "字节跳动",
        position: "后端开发",
        round: "一面",
      }),
    ).toBe("字节跳动 · 后端开发 · 一面");
  });

  it("derives tags from company and round", () => {
    expect(
      buildInterviewTags({ company: "腾讯", round: "二面" }),
    ).toEqual(["腾讯", "二面"]);
  });
});
