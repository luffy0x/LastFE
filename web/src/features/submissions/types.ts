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

export type SubmissionResponse =
  | { ok: true; issueNumber: number }
  | {
      ok: false;
      code: "INVALID" | "CHALLENGE" | "RATE_LIMIT" | "DUPLICATE" | "UPSTREAM";
      message: string;
    };
