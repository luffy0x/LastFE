import type { Submission } from "@/features/submissions/types";

export type SubmissionQueue = {
  enqueue(submission: Submission): Promise<{ issueNumber: number }>;
};

export function createSubmissionQueue(): SubmissionQueue {
  return {
    async enqueue() {
      throw new Error("Submission queue adapter is not configured");
    },
  };
}
