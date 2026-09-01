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
      REGIONS.map(({ slug, schemaKey, submissionFields }) => ({
        slug,
        schemaKey,
        fields: submissionFields.map((field) => field.name),
      })),
    ).toEqual([
      {
        slug: "interview",
        schemaKey: "interview",
        fields: ["companyDepartment", "position", "tags", "nickname", "markdown"],
      },
      {
        slug: "resources",
        schemaKey: "resource",
        fields: ["title", "url", "summary", "tags", "nickname"],
      },
      {
        slug: "fundamentals",
        schemaKey: "fundamental",
        fields: ["title", "category", "tags", "nickname", "markdown"],
      },
      {
        slug: "projects",
        schemaKey: "project",
        fields: [
          "title",
          "techStack",
          "repositoryUrl",
          "demoUrl",
          "tags",
          "nickname",
          "markdown",
        ],
      },
      {
        slug: "algorithms",
        schemaKey: "algorithm",
        fields: [
          "title",
          "source",
          "difficulty",
          "problemUrl",
          "tags",
          "nickname",
          "markdown",
        ],
      },
    ]);
  });
});
