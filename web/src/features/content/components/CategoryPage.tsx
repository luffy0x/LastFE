import Link from "next/link";

import { Button } from "@/components/Button";
import { ContentCard, contentCardTint } from "@/components/ContentCard";
import type { CategoryDefinition } from "../categories";
import { ALGORITHM_SITES, RESUME_SITES } from "../site-icons";
import type { ContentSummary, Page } from "../types";

import { RecommendedSiteCards } from "./RecommendedSiteCards";
import { TopicAccordion, type ContentGroup } from "./ContentAccordion";

type CategoryPageProps = {
  category: CategoryDefinition;
  page: Page<ContentSummary>;
  query?: Readonly<Record<string, string>>;
};

const FIELD_LABELS: Readonly<Record<string, string>> = {
  company: "公司",
  position: "岗位",
  round: "几面",
  interviewDate: "时间",
  tags: "标签",
  category: "知识分类",
  techStack: "技术栈",
  source: "来源",
  difficulty: "难度",
  stage: "进展阶段",
  applicationDate: "投递时间",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FUNDAMENTALS_TOPIC_ORDER = [
  "HTML",
  "CSS",
  "JavaScript",
  "浏览器",
  "计算机网络",
  "Web 安全",
  "操作系统",
  "TypeScript",
  "工程化",
  "React",
  "Vue",
  "AI / Agent",
] as const;

const ALGORITHM_TOPIC_ORDER = ["CSS", "JavaScript"] as const;

function groupContentByTopic(
  items: readonly ContentSummary[],
  categorySlug: string,
): readonly ContentGroup[] {
  const groups = new Map<string, ContentSummary[]>();
  for (const item of items) {
    const topic = item.metadata.category?.trim() || "未分类";
    const contents = groups.get(topic);
    if (contents) contents.push(item);
    else groups.set(topic, [item]);
  }

  const orderedTopics: readonly string[] =
    (categorySlug === "fundamentals"
      ? FUNDAMENTALS_TOPIC_ORDER
      : ALGORITHM_TOPIC_ORDER);
  const topicOrder = new Map<string, number>(
    orderedTopics.map((topic, index) => [topic, index]),
  );
  const unrankedTopicOrder = topicOrder.size;

  return Array.from(groups, ([title, groupedItems], index) => ({
    id: `topic-${index}`,
    title,
    items: groupedItems,
  })).sort(
    (left, right) =>
      (topicOrder.get(left.title) ?? unrankedTopicOrder) -
      (topicOrder.get(right.title) ?? unrankedTopicOrder),
  );
}

export function CategoryPage({
  category,
  page,
  query = {},
}: CategoryPageProps) {
  const hasActiveQuery = Object.keys(query).length > 0;
  const usesAccordion = ["fundamentals", "algorithms"].includes(category.slug);
  const topicGroups = usesAccordion
    ? groupContentByTopic(page.items, category.slug)
    : [];
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
          // 筛选标签优先用投稿字段自带的 label，保证「岗位」「目标岗位」等同名键在不同分类下含义准确
          const fieldLabel = field?.label ?? FIELD_LABELS[key] ?? key;
          return (
            <label key={key}>
              <span>{fieldLabel}</span>
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

      {category.slug === "algorithms" ? (
        <RecommendedSiteCards
          title="刷题网站推荐"
          sites={ALGORITHM_SITES}
        />
      ) : null}
      {category.slug === "resume" ? (
        <RecommendedSiteCards title="简历制作网站推荐" sites={RESUME_SITES} />
      ) : null}

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
      ) : usesAccordion ? (
        <TopicAccordion
          key={category.slug}
          groups={topicGroups}
          groupLabel={category.slug === "fundamentals" ? "专题" : "题型"}
          idPrefix={`${category.slug}-topics`}
        />
      ) : (
        <div className="content-grid">
          {page.items.map((item, index) => (
            <ContentCard
              key={item.id}
              href={`/content/${item.id}`}
              title={item.title}
              eyebrow={dateFormatter.format(new Date(item.publishedAt))}
              description={item.summary ?? undefined}
              tint={contentCardTint(index)}
            />
          ))}
        </div>
      )}

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
