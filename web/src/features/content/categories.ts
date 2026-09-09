export type CategoryTheme = "amber" | "teal" | "magenta" | "indigo" | "cyan";

type SubmissionFieldBase = {
  name: string;
  label: string;
  required: boolean;
  maxLength?: number;
};

export type SubmissionFieldDefinition =
  | (SubmissionFieldBase & { kind: "text" })
  | (SubmissionFieldBase & { kind: "tags" })
  | (SubmissionFieldBase & { kind: "url" })
  | (SubmissionFieldBase & {
      kind: "select";
      options: readonly { value: string; label: string }[];
    })
  | (SubmissionFieldBase & { kind: "markdown" });

export type CategoryDefinition = {
  slug: string;
  href: `/regions/${string}`;
  label: string;
  description: string;
  theme: CategoryTheme;
  schemaKey:
    | "interview"
    | "resource"
    | "fundamental"
    | "project"
    | "algorithm";
  submissionFields: readonly SubmissionFieldDefinition[];
  filterKeys: readonly string[];
  summaryFields: readonly string[];
  enabled: boolean;
};

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "简单" },
  { value: "medium", label: "中等" },
  { value: "hard", label: "困难" },
] as const;

export const CATEGORIES = [
  {
    slug: "interview",
    href: "/regions/interview",
    label: "面经记录",
    description: "公司与岗位实战记录，标记真实面试路径。",
    theme: "amber",
    schemaKey: "interview",
    submissionFields: [
      { name: "companyDepartment", label: "公司 / 部门", kind: "text", required: true, maxLength: 80 },
      { name: "position", label: "岗位", kind: "text", required: true, maxLength: 80 },
      { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
      { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
      { name: "markdown", label: "面经内容", kind: "markdown", required: true, maxLength: 50 * 1024 },
    ],
    filterKeys: ["companyDepartment", "position", "tags"],
    summaryFields: ["companyDepartment", "position", "tags"],
    enabled: true,
  },
  {
    slug: "resources",
    href: "/regions/resources",
    label: "学习资料",
    description: "经过整理的课程、路线与外部学习入口。",
    theme: "teal",
    schemaKey: "resource",
    submissionFields: [
      { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
      { name: "url", label: "URL", kind: "url", required: true, maxLength: 2048 },
      { name: "summary", label: "摘要", kind: "text", required: false, maxLength: 2000 },
      { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
      { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
    ],
    filterKeys: ["tags"],
    summaryFields: ["tags"],
    enabled: true,
  },
  {
    slug: "fundamentals",
    href: "/regions/fundamentals",
    label: "八股盛宴",
    description: "把零散知识组织成可检索的基础内容。",
    theme: "magenta",
    schemaKey: "fundamental",
    submissionFields: [
      { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
      { name: "category", label: "分类", kind: "text", required: true, maxLength: 60 },
      { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
      { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
      { name: "markdown", label: "内容", kind: "markdown", required: true, maxLength: 50 * 1024 },
    ],
    filterKeys: ["category", "tags"],
    summaryFields: ["category", "tags"],
    enabled: true,
  },
  {
    slug: "projects",
    href: "/regions/projects",
    label: "项目推荐",
    description: "拆解能讲清取舍与结果的项目实践。",
    theme: "indigo",
    schemaKey: "project",
    submissionFields: [
      { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
      { name: "techStack", label: "技术栈", kind: "tags", required: true, maxLength: 24 },
      { name: "repositoryUrl", label: "仓库 URL", kind: "url", required: false, maxLength: 2048 },
      { name: "demoUrl", label: "演示 URL", kind: "url", required: false, maxLength: 2048 },
      { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
      { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
      { name: "markdown", label: "项目说明", kind: "markdown", required: true, maxLength: 50 * 1024 },
    ],
    filterKeys: ["techStack", "tags"],
    summaryFields: ["techStack", "tags"],
    enabled: true,
  },
  {
    slug: "algorithms",
    href: "/regions/algorithms",
    label: "算法手撕",
    description: "按来源和难度组织训练路线与题解。",
    theme: "cyan",
    schemaKey: "algorithm",
    submissionFields: [
      { name: "title", label: "标题", kind: "text", required: true, maxLength: 120 },
      { name: "source", label: "来源", kind: "text", required: true, maxLength: 60 },
      {
        name: "difficulty",
        label: "难度",
        kind: "select",
        required: true,
        options: DIFFICULTY_OPTIONS,
      },
      { name: "problemUrl", label: "题目 URL", kind: "url", required: false, maxLength: 2048 },
      { name: "tags", label: "标签", kind: "tags", required: true, maxLength: 24 },
      { name: "nickname", label: "昵称", kind: "text", required: false, maxLength: 40 },
      { name: "markdown", label: "题解", kind: "markdown", required: true, maxLength: 50 * 1024 },
    ],
    filterKeys: ["source", "difficulty", "tags"],
    summaryFields: ["source", "difficulty", "tags"],
    enabled: true,
  },
] as const satisfies readonly CategoryDefinition[];

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function getCategory(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find(
    (category) => category.slug === slug && category.enabled,
  );
}
