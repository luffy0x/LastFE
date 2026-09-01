import { describe, expect, it } from "vitest";

import { REGIONS } from "../map/regions";
import { isSafeHttpUrl, parseSubmission } from "./schemas";

const VALID_INTERVIEW_INPUT = {
  regionSlug: "interview",
  companyDepartment: "字节跳动/基础架构",
  position: "后端开发",
  tags: ["一面", "Go"],
  nickname: "",
  markdown: "面试记录",
};

const validInputs = {
  interview: VALID_INTERVIEW_INPUT,
  resources: {
    regionSlug: "resources",
    title: "Go 入门资料",
    url: "https://example.com/go",
    tags: ["Go"],
  },
  fundamentals: {
    regionSlug: "fundamentals",
    title: "Go 并发",
    category: "并发",
    tags: ["Go"],
    markdown: "内容",
  },
  projects: {
    regionSlug: "projects",
    title: "内容平台",
    techStack: ["Next.js", "Go"],
    tags: ["全栈"],
    markdown: "项目说明",
  },
  algorithms: {
    regionSlug: "algorithms",
    title: "两数之和",
    source: "LeetCode",
    difficulty: "easy",
    tags: ["数组"],
    markdown: "题解",
  },
} as const;

const urlAtMaximumLength = `https://example.com/${"a".repeat(2_028)}`;
const urlAboveMaximumLength = `https://example.com/${"a".repeat(2_029)}`;

describe("parseSubmission", () => {
  it("generates an interview title from company and position", () => {
    const submission = parseSubmission("interview", VALID_INTERVIEW_INPUT);

    expect(submission.title).toBe("字节跳动/基础架构 · 后端开发");
    expect(submission.nickname).toBeUndefined();
  });

  it("accepts an omitted nickname in every territory", () => {
    for (const [regionSlug, input] of Object.entries(validInputs)) {
      const submission = parseSubmission(regionSlug, input);

      expect(submission.nickname).toBeUndefined();
    }
  });

  it("accepts a project without either optional link", () => {
    const submission = parseSubmission("projects", validInputs.projects);

    expect(submission.regionSlug).toBe("projects");
    expect(submission).not.toHaveProperty("repositoryUrl");
    expect(submission).not.toHaveProperty("demoUrl");
  });

  it.each([
    ["empty text", { ...validInputs.resources, title: "" }],
    ["whitespace-only text", { ...validInputs.resources, title: "   " }],
    ["a carriage return", { ...validInputs.resources, title: "first\rsecond" }],
    ["a line feed", { ...validInputs.resources, title: "first\nsecond" }],
    ["a control character", { ...validInputs.resources, title: "first\u0000second" }],
    ["a tab", { ...validInputs.resources, title: "first\tsecond" }],
    ["a C1 control character", { ...validInputs.resources, title: "first\u0085second" }],
    ["a Unicode line separator", { ...validInputs.resources, title: "first\u2028second" }],
    ["a Unicode paragraph separator", { ...validInputs.resources, title: "first\u2029second" }],
    [
      "an 81-character company or department",
      { ...VALID_INTERVIEW_INPUT, companyDepartment: "a".repeat(81) },
    ],
  ])("rejects %s", (_label, input) => {
    expect(() => parseSubmission(input.regionSlug, input)).toThrow();
  });

  it("rejects markdown larger than 50 KiB measured in UTF-8 bytes", () => {
    const tooLargeMarkdown = "界".repeat(17_067);

    expect(Buffer.byteLength(tooLargeMarkdown, "utf8")).toBe(51_201);
    expect(() =>
      parseSubmission("fundamentals", {
        ...validInputs.fundamentals,
        markdown: tooLargeMarkdown,
      }),
    ).toThrow();
  });

  it("accepts markdown at the 50 KiB UTF-8 byte limit", () => {
    const markdownAtLimit = "界".repeat(17_066) + "ab";

    expect(Buffer.byteLength(markdownAtLimit, "utf8")).toBe(51_200);
    expect(() =>
      parseSubmission("fundamentals", {
        ...validInputs.fundamentals,
        markdown: markdownAtLimit,
      }),
    ).not.toThrow();
  });

  it.each([
    ["six tags", ["a", "b", "c", "d", "e", "f"]],
    ["duplicate tags after normalization", ["Go", " go "]],
  ])("rejects %s", (_label, tags) => {
    expect(() =>
      parseSubmission("resources", { ...validInputs.resources, tags }),
    ).toThrow();
  });

  it("retains the first user-facing tag spelling", () => {
    const submission = parseSubmission("resources", {
      ...validInputs.resources,
      tags: ["  GoLang  "],
    });

    expect(submission.tags).toEqual(["GoLang"]);
  });

  it("rejects an unsupported algorithm difficulty", () => {
    expect(() =>
      parseSubmission("algorithms", {
        ...validInputs.algorithms,
        difficulty: "expert",
      }),
    ).toThrow();
  });

  it.each(["javascript:alert(1)", "ftp://example.com/file"]) (
    "rejects unsafe resource URL %s",
    (url) => {
      expect(() =>
        parseSubmission("resources", { ...validInputs.resources, url }),
      ).toThrow(/http/i);
      expect(isSafeHttpUrl(url)).toBe(false);
    },
  );

  it.each(["https://example.com", "http://example.com/path"]) (
    "accepts safe HTTP URL %s",
    (url) => {
      expect(isSafeHttpUrl(url)).toBe(true);
    },
  );

  it.each([
    ["required resource URL", "resources", "url", validInputs.resources],
    ["optional project repository URL", "projects", "repositoryUrl", validInputs.projects],
    ["optional project demo URL", "projects", "demoUrl", validInputs.projects],
    ["optional algorithm problem URL", "algorithms", "problemUrl", validInputs.algorithms],
  ])("accepts a 2048-character %s", (_label, regionSlug, fieldName, input) => {
    expect(urlAtMaximumLength).toHaveLength(2_048);
    expect(isSafeHttpUrl(urlAtMaximumLength)).toBe(true);
    expect(() => parseSubmission(regionSlug, { ...input, [fieldName]: urlAtMaximumLength })).not.toThrow();
  });

  it.each([
    ["required resource URL", "resources", "url", validInputs.resources],
    ["optional project repository URL", "projects", "repositoryUrl", validInputs.projects],
    ["optional project demo URL", "projects", "demoUrl", validInputs.projects],
    ["optional algorithm problem URL", "algorithms", "problemUrl", validInputs.algorithms],
  ])("rejects a 2049-character %s", (_label, regionSlug, fieldName, input) => {
    expect(urlAboveMaximumLength).toHaveLength(2_049);
    expect(isSafeHttpUrl(urlAboveMaximumLength)).toBe(false);
    expect(() => parseSubmission(regionSlug, { ...input, [fieldName]: urlAboveMaximumLength })).toThrow();
  });

  it("rejects a mismatch between the requested region and payload slug", () => {
    expect(() => parseSubmission("resources", VALID_INTERVIEW_INPUT)).toThrow();
  });

  it("rejects an unknown region", () => {
    expect(() => parseSubmission("unknown", validInputs.resources)).toThrow();
  });
});

describe("region submission fields", () => {
  it("exposes the territory schemas as data-driven form definitions", () => {
    expect(
      REGIONS.map(({ slug, schemaKey, submissionFields }) => ({ slug, schemaKey, submissionFields })),
    ).toEqual([
      {
        slug: "interview",
        schemaKey: "interview",
        submissionFields: [
          { name: "companyDepartment", label: "公司 / 部门", kind: "text", required: true, maxLength: 80 },
          { name: "position", label: "岗位", kind: "text", required: true, maxLength: 80 },
          { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
          { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
          { name: "markdown", label: "面经内容", kind: "markdown", required: true, maxLength: 51_200 },
        ],
      },
      {
        slug: "resources",
        schemaKey: "resource",
        submissionFields: [
          { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
          { name: "url", label: "URL", kind: "url", required: true, maxLength: 2_048 },
          { name: "summary", label: "摘要", kind: "text", required: false, maxLength: 2000 },
          { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
          { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
        ],
      },
      {
        slug: "fundamentals",
        schemaKey: "fundamental",
        submissionFields: [
          { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
          { name: "category", label: "分类", kind: "text", required: true, maxLength: 60 },
          { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
          { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
          { name: "markdown", label: "内容", kind: "markdown", required: true, maxLength: 51_200 },
        ],
      },
      {
        slug: "projects",
        schemaKey: "project",
        submissionFields: [
          { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
          { name: "techStack", label: "技术栈", kind: "tags", required: true, maxLength: 24 },
          { name: "repositoryUrl", label: "仓库 URL", kind: "url", required: false, maxLength: 2_048 },
          { name: "demoUrl", label: "演示 URL", kind: "url", required: false, maxLength: 2_048 },
          { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
          { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
          { name: "markdown", label: "项目说明", kind: "markdown", required: true, maxLength: 51_200 },
        ],
      },
      {
        slug: "algorithms",
        schemaKey: "algorithm",
        submissionFields: [
          { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
          { name: "source", label: "来源", kind: "text", required: true, maxLength: 60 },
          {
            name: "difficulty",
            label: "难度",
            kind: "select",
            required: true,
            options: [
              { value: "easy", label: "简单" },
              { value: "medium", label: "中等" },
              { value: "hard", label: "困难" },
            ],
          },
          { name: "problemUrl", label: "题目 URL", kind: "url", required: false, maxLength: 2_048 },
          { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
          { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
          { name: "markdown", label: "题解", kind: "markdown", required: true, maxLength: 51_200 },
        ],
      },
    ]);
  });
});
