import { describe, expect, it } from "vitest";

import { createSubmissionQueue } from "./queue";

describe("temporary submission queue seam", () => {
  it("fails closed until Task 5 installs the GitHub adapter", async () => {
    const queue = createSubmissionQueue();

    await expect(
      queue.enqueue({
        regionSlug: "interview",
        companyDepartment: "字节跳动/基础架构",
        position: "后端开发",
        tags: ["一面"],
        nickname: undefined,
        markdown: "面试记录",
        title: "字节跳动/基础架构 · 后端开发",
      }),
    ).rejects.toThrow();
  });
});
