import type { Submission } from "@/features/submissions/types";

export type SubmissionQueue = {
  enqueue(submission: Submission): Promise<{ issueNumber: number }>;
};
