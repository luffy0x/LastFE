import { describe, expect, it } from "vitest";

import {
  createSourceHasher,
  fingerprintSubmission,
} from "./rate-limit";

const submission = {
  regionSlug: "interview" as const,
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面"],
  nickname: "匿名甲",
  markdown: "面试记录",
  title: "字节跳动/基础架构 · 后端开发",
};

describe("submission abuse identifiers", () => {
  it("derives a deterministic HMAC without retaining the raw source", () => {
    const hashSource = createSourceHasher("test-rate-limit-secret");

    const first = hashSource("203.0.113.10");

    expect(first).toBe(hashSource("203.0.113.10"));
    expect(first).not.toContain("203.0.113.10");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("canonicalizes object keys and excludes nickname from the fingerprint", () => {
    const reordered = {
      title: submission.title,
      markdown: submission.markdown,
      nickname: "另一个昵称",
      website: "should-not-affect-fingerprint",
      altcha: "changing-proof",
      tags: submission.tags,
      position: submission.position,
      companyDepartment: submission.companyDepartment,
      regionSlug: submission.regionSlug,
    };

    expect(fingerprintSubmission(submission)).toBe(
      fingerprintSubmission(reordered as typeof submission),
    );
  });

  it("keeps content fields in the fingerprint", () => {
    expect(fingerprintSubmission(submission)).not.toBe(
      fingerprintSubmission({ ...submission, markdown: "不同的面试记录" }),
    );
  });
});
