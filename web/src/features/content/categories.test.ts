import { describe, expect, it } from "vitest";

import { CATEGORIES, getCategory } from "./categories";

describe("CATEGORIES", () => {
  it("defines exactly seven categories", () => {
    expect(CATEGORIES).toHaveLength(7);
  });

  it("has unique slugs and matching hrefs", () => {
    const slugs = CATEGORIES.map((category) => category.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const category of CATEGORIES) {
      expect(category.href).toBe(`/regions/${category.slug}`);
    }
  });

  it("every enabled category has submission fields and filter keys", () => {
    for (const category of CATEGORIES.filter(({ enabled }) => enabled)) {
      expect(category.submissionFields.length).toBeGreaterThan(0);
      expect(category.filterKeys.length).toBeGreaterThan(0);
      for (const key of category.filterKeys) {
        // tags 是所有分类共用的筛选键，由表单统一提供，不属于单独的表单字段。
        if (key === "tags") continue;
        expect(
          category.submissionFields.some((field) => field.name === key),
        ).toBe(true);
      }
    }
  });

  it("carries the expected category labels in display order", () => {
    expect(CATEGORIES.map(({ label }) => label)).toEqual([
      "学习资料",
      "项目推荐",
      "八股盛宴",
      "算法手撕",
      "简历制作",
      "投递记录",
      "面经记录",
    ]);
  });

  it("getCategory returns enabled categories and rejects unknown slugs", () => {
    expect(getCategory("projects")?.label).toBe("项目推荐");
    expect(getCategory("unknown")).toBeUndefined();
  });
});
