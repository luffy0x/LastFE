import type { RegionDefinition } from "./types";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "简单" },
  { value: "medium", label: "中等" },
  { value: "hard", label: "困难" },
] as const;

export const REGION_ANCHORS = {
  interview: { x: 228, y: 166 },
  resources: { x: 683, y: 153 },
  fundamentals: { x: 500, y: 300 },
  projects: { x: 232, y: 385 },
  algorithms: { x: 759, y: 372 },
} as const;

export const REGION_PATHS = {
  interview: "M61 73H383L414 194L329 278L49 245L35 152Z",
  resources: "M383 73H943L957 198L650 250L414 194Z",
  fundamentals: "M329 278L414 194L650 250L610 420L379 418Z",
  projects: "M49 245L329 278L379 418L300 552L42 470Z",
  algorithms: "M650 250L957 198L970 510L610 420Z",
} as const;

const ROUTE_PATHS = {
  interviewFundamentals: "M228 166 Q360 220 500 300",
  resourcesFundamentals: "M683 153 Q600 220 500 300",
  projectsFundamentals: "M232 385 Q360 365 500 300",
  algorithmsFundamentals: "M759 372 Q630 350 500 300",
  interviewProjects: "M228 166 Q190 280 232 385",
  resourcesAlgorithms: "M683 153 Q790 245 759 372",
} as const;

export const REGIONS = [
  {
    slug: "interview",
    href: "/regions/interview",
    label: "面经区",
    description: "公司与岗位实战记录，标记真实面试路径。",
    svgPath: REGION_PATHS.interview,
    anchor: REGION_ANCHORS.interview,
    camera: { ...REGION_ANCHORS.interview, scale: 1.5 },
    routes: [
      {
        to: "fundamentals",
        path: ROUTE_PATHS.interviewFundamentals,
        reverse: false,
      },
      {
        to: "projects",
        path: ROUTE_PATHS.interviewProjects,
        reverse: false,
      },
    ],
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
    label: "学习资料区",
    description: "经过整理的课程、路线与外部学习入口。",
    svgPath: REGION_PATHS.resources,
    anchor: REGION_ANCHORS.resources,
    camera: { ...REGION_ANCHORS.resources, scale: 1.42 },
    routes: [
      {
        to: "fundamentals",
        path: ROUTE_PATHS.resourcesFundamentals,
        reverse: false,
      },
      {
        to: "algorithms",
        path: ROUTE_PATHS.resourcesAlgorithms,
        reverse: false,
      },
    ],
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
    label: "八股区",
    description: "把零散知识组织成可检索的基础情报。",
    svgPath: REGION_PATHS.fundamentals,
    anchor: REGION_ANCHORS.fundamentals,
    camera: { ...REGION_ANCHORS.fundamentals, scale: 1.58 },
    routes: [
      {
        to: "interview",
        path: ROUTE_PATHS.interviewFundamentals,
        reverse: true,
      },
      {
        to: "resources",
        path: ROUTE_PATHS.resourcesFundamentals,
        reverse: true,
      },
      {
        to: "projects",
        path: ROUTE_PATHS.projectsFundamentals,
        reverse: true,
      },
      {
        to: "algorithms",
        path: ROUTE_PATHS.algorithmsFundamentals,
        reverse: true,
      },
    ],
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
    label: "项目区",
    description: "拆解能讲清取舍与结果的项目实践。",
    svgPath: REGION_PATHS.projects,
    anchor: REGION_ANCHORS.projects,
    camera: { ...REGION_ANCHORS.projects, scale: 1.45 },
    routes: [
      {
        to: "fundamentals",
        path: ROUTE_PATHS.projectsFundamentals,
        reverse: false,
      },
      {
        to: "interview",
        path: ROUTE_PATHS.interviewProjects,
        reverse: true,
      },
    ],
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
    label: "算法区",
    description: "按来源和难度组织训练路线与题解。",
    svgPath: REGION_PATHS.algorithms,
    anchor: REGION_ANCHORS.algorithms,
    camera: { ...REGION_ANCHORS.algorithms, scale: 1.4 },
    routes: [
      {
        to: "fundamentals",
        path: ROUTE_PATHS.algorithmsFundamentals,
        reverse: false,
      },
      {
        to: "resources",
        path: ROUTE_PATHS.resourcesAlgorithms,
        reverse: true,
      },
    ],
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
] as const satisfies readonly RegionDefinition[];
