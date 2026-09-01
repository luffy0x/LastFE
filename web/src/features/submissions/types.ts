export type SubmissionFieldDefinition = {
  name: string;
  label: string;
  kind: "text" | "tags" | "url" | "select" | "markdown";
  required: boolean;
  maxLength?: number;
  options?: readonly { value: string; label: string }[];
};

type SubmissionBase = {
  tags: string[];
  nickname: string | undefined;
};

export type InterviewSubmission = SubmissionBase & {
  regionSlug: "interview";
  companyDepartment: string;
  position: string;
  markdown: string;
  title: string;
};

export type ResourceSubmission = SubmissionBase & {
  regionSlug: "resources";
  title: string;
  url: string;
  summary?: string;
};

export type FundamentalSubmission = SubmissionBase & {
  regionSlug: "fundamentals";
  title: string;
  category: string;
  markdown: string;
};

export type ProjectSubmission = SubmissionBase & {
  regionSlug: "projects";
  title: string;
  techStack: string[];
  repositoryUrl?: string;
  demoUrl?: string;
  markdown: string;
};

export type AlgorithmSubmission = SubmissionBase & {
  regionSlug: "algorithms";
  title: string;
  source: string;
  difficulty: "easy" | "medium" | "hard";
  problemUrl?: string;
  markdown: string;
};

export type Submission =
  | InterviewSubmission
  | ResourceSubmission
  | FundamentalSubmission
  | ProjectSubmission
  | AlgorithmSubmission;
