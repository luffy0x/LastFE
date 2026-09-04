import { z } from "zod";
import { REGIONS } from "@/features/map/regions";

const regionSlugSet = new Set<string>(REGIONS.map((region) => region.slug));

const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "链接只允许 http 或 https",
  });

export function isSafeHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

const tagList = z
  .array(z.string().trim().min(1).max(24))
  .min(1)
  .max(5)
  .transform((tags) => Array.from(new Set(tags.map((tag) => tag.trim()))));

const baseSubmissionSchema = z.object({
  regionSlug: z.string().refine((value) => regionSlugSet.has(value), {
    message: "未知投稿领地",
  }),
  title: z.string().trim().min(1).max(120),
  summary: optionalText(2000),
  tags: tagList,
  nickname: optionalText(40),
  markdown: optionalText(50 * 1024),
  externalUrl: safeUrl.optional().nullable().transform((value) => value ?? null),
  metadata: z.record(z.string(), z.string().trim().max(120)).default({}),
});

export type SubmissionInput = {
  regionSlug: string;
  title: string;
  summary: string | null;
  tags: readonly string[];
  nickname: string | null;
  markdown: string | null;
  externalUrl: string | null;
  metadata: Readonly<Record<string, string>>;
};

function requireMetadata(
  metadata: Readonly<Record<string, string>>,
  key: string,
  label: string,
): void {
  const value = metadata[key]?.trim();
  if (!value) throw new Error(`${label}不能为空`);
}

function assertMarkdown(value: string | null): void {
  if (!value) throw new Error("Markdown 正文不能为空");
}

function validateRegionSpecific(input: SubmissionInput): void {
  if (input.regionSlug === "interview") {
    requireMetadata(input.metadata, "companyDepartment", "公司/部门");
    requireMetadata(input.metadata, "position", "岗位");
    assertMarkdown(input.markdown);
  }

  if (input.regionSlug === "resources" && !input.externalUrl) {
    throw new Error("学习资料链接不能为空");
  }

  if (input.regionSlug === "fundamentals") {
    requireMetadata(input.metadata, "category", "知识分类");
    assertMarkdown(input.markdown);
  }

  if (input.regionSlug === "projects") {
    requireMetadata(input.metadata, "techStack", "技术栈");
    assertMarkdown(input.markdown);
  }

  if (input.regionSlug === "algorithms") {
    requireMetadata(input.metadata, "source", "来源");
    requireMetadata(input.metadata, "difficulty", "难度");
    assertMarkdown(input.markdown);
  }
}

export function parseSubmissionInput(value: unknown): SubmissionInput {
  try {
    const input = baseSubmissionSchema.parse(value);
    validateRegionSpecific(input);
    return input;
  } catch {
    throw new Error("投稿内容不符合要求");
  }
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLocaleLowerCase();
}
