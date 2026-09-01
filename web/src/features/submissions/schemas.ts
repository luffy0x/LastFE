import { z } from "zod";

import type { Submission } from "./types";

const utf8ByteLength = (value: string) => new TextEncoder().encode(value).length;
const MAX_URL_LENGTH = 2_048;

const text = (minimumLength: number, maximumLength: number) =>
  z.string().trim().min(minimumLength).max(maximumLength);

const singleLineText = (minimumLength: number, maximumLength: number) =>
  text(minimumLength, maximumLength).refine(
    (value) => !/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(value),
    "Text must be a single line without control characters.",
  );

const tags = z
  .array(singleLineText(1, 24))
  .min(1)
  .max(5)
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.forEach((tag, index) => {
      const normalized = tag.normalize("NFC").toLowerCase();

      if (seen.has(normalized)) {
        context.addIssue({
          code: "custom",
          message: "Tags must be unique.",
          path: [index],
        });
      }

      seen.add(normalized);
    });
  });

const nickname = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    singleLineText(0, 40).optional(),
  )
  .transform((value) => value || undefined);

const markdown = z.string().superRefine((value, context) => {
  const byteLength = utf8ByteLength(value);

  if (byteLength < 1 || byteLength > 50 * 1024) {
    context.addIssue({
      code: "custom",
      message: "Markdown must contain between 1 byte and 50 KiB of UTF-8 text.",
    });
  }
});

export const isSafeHttpUrl = (url: string): boolean => {
  const normalizedUrl = url.trim();

  if (normalizedUrl.length > MAX_URL_LENGTH) {
    return false;
  }

  try {
    const parsed = new URL(normalizedUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const safeHttpUrl = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH)
  .refine(isSafeHttpUrl, "URL must use http or https.");

export const SUBMISSION_SCHEMAS = {
  interview: z
    .object({
      regionSlug: z.literal("interview"),
      companyDepartment: singleLineText(1, 80),
      position: singleLineText(1, 80),
      tags,
      nickname,
      markdown,
    })
    .transform((value) => ({
      ...value,
      title: `${value.companyDepartment} · ${value.position}`,
    })),
  resource: z.object({
    regionSlug: z.literal("resources"),
    title: singleLineText(1, 120),
    url: safeHttpUrl,
    summary: text(0, 2000).optional(),
    tags,
    nickname,
  }),
  fundamental: z.object({
    regionSlug: z.literal("fundamentals"),
    title: singleLineText(1, 120),
    category: singleLineText(1, 60),
    tags,
    nickname,
    markdown,
  }),
  project: z.object({
    regionSlug: z.literal("projects"),
    title: singleLineText(1, 120),
    techStack: tags,
    repositoryUrl: safeHttpUrl.optional(),
    demoUrl: safeHttpUrl.optional(),
    tags,
    nickname,
    markdown,
  }),
  algorithm: z.object({
    regionSlug: z.literal("algorithms"),
    title: singleLineText(1, 120),
    source: singleLineText(1, 60),
    difficulty: z.enum(["easy", "medium", "hard"]),
    problemUrl: safeHttpUrl.optional(),
    tags,
    nickname,
    markdown,
  }),
} as const;

const schemaKeyByRegionSlug = {
  interview: "interview",
  resources: "resource",
  fundamentals: "fundamental",
  projects: "project",
  algorithms: "algorithm",
} as const;

export const parseSubmission = (regionSlug: string, input: unknown): Submission => {
  const schemaKey = schemaKeyByRegionSlug[regionSlug as keyof typeof schemaKeyByRegionSlug];

  if (!schemaKey) {
    throw new Error(`Unknown submission region: ${regionSlug}`);
  }

  return SUBMISSION_SCHEMAS[schemaKey].parse(input) as Submission;
};
