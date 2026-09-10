import Link from "next/link";

import { Button } from "@/components/Button";
import { ContentCard, contentCardTint } from "@/components/ContentCard";
import type { CategoryDefinition } from "../categories";
import type { ContentSummary, Page } from "../types";

type CategoryPageProps = {
  category: CategoryDefinition;
  page: Page<ContentSummary>;
  query?: Readonly<Record<string, string>>;
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  companyDepartment: "公司/部门",
  position: "岗位",
  tags: "标签",
  category: "知识分类",
  techStack: "技术栈",
  source: "来源",
  difficulty: "难度",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function CategoryPage({
  category,
  page,
  query = {},
}: CategoryPageProps) {
  const hasActiveQuery = Object.keys(query).length > 0;
  const pageCount = Math.max(1, Math.ceil(page.total / page.pageSize));
  const pageHref = (pageNumber: number) => {
    const parameters = new URLSearchParams(query);
    if (pageNumber > 1) parameters.set("page", String(pageNumber));
    const search = parameters.toString();
    return `/regions/${category.slug}${search ? `?${search}` : ""}`;
  };

  return (
    <>
      <nav className="breadcrumb" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{category.label}</span>
      </nav>

      <header className="category-page__header">
        <h1>{category.label}</h1>
        <p>{category.description}</p>
      </header>

      <form className="category-filters" role="search" method="get">
        <label>
          <span>搜索本分类</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="搜索标题、标签或正文"
          />
        </label>
        {category.filterKeys.map((key) => {
          const field = category.submissionFields.find(
            ({ name }) => name === key,
          );
          return (
            <label key={key}>
              <span>{FIELD_LABELS[key] ?? key}</span>
              {field?.kind === "select" ? (
                <select name={key} defaultValue={query[key] ?? ""}>
                  <option value="">全部</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name={key}
                  defaultValue={query[key] ?? ""}
                />
              )}
            </label>
          );
        })}
        <Button type="submit" arrow={false}>
          应用筛选
        </Button>
      </form>

      <div className="content-grid">
        {page.items.length === 0 ? (
          <div className="category-empty">
            <p>
              {hasActiveQuery || page.page > 1
                ? "没有符合当前条件的公开内容。"
                : "该分类还没有公开内容。"}
            </p>
            {hasActiveQuery || page.page > 1 ? (
              <Link href={`/regions/${category.slug}`}>清除搜索与筛选</Link>
            ) : null}
          </div>
        ) : (
          page.items.map((item, index) => (
            <ContentCard
              key={item.id}
              href={`/content/${item.id}`}
              title={item.title}
              eyebrow={dateFormatter.format(new Date(item.publishedAt))}
              description={item.summary ?? undefined}
              tint={contentCardTint(index)}
            />
          ))
        )}
      </div>

      {pageCount > 1 ? (
        <nav className="category-pagination" aria-label="内容分页">
          {page.page > 1 ? (
            <Link rel="prev" href={pageHref(page.page - 1)}>
              上一页
            </Link>
          ) : (
            <span />
          )}
          <span>
            第 {page.page} / {pageCount} 页
          </span>
          {page.page < pageCount ? (
            <Link rel="next" href={pageHref(page.page + 1)}>
              下一页
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <footer className="category-page__footer">
        <span>共 {page.total} 条公开内容，投稿经审核后发布</span>
        <Button href={`/submit/${category.slug}`} variant="secondary">
          向{category.label}投稿
        </Button>
      </footer>
    </>
  );
}
