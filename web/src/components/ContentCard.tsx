import Link from "next/link";
import type { ReactNode } from "react";

export const CONTENT_CARD_TINTS = ["blue", "violet", "graphite"] as const;

export type ContentCardTint = (typeof CONTENT_CARD_TINTS)[number];

export function contentCardTint(index: number): ContentCardTint {
  return CONTENT_CARD_TINTS[index % CONTENT_CARD_TINTS.length];
}

type ContentCardProps = {
  /** 卡片主链接目标；提供后整卡可点击并跳转该地址 */
  href: string;
  title: string;
  /** 标题上方的短元信息，如日期、分类名 */
  eyebrow?: string;
  description?: string;
  /** accent 色的行动引导文案，默认“阅读全文” */
  action?: string;
  /** 右上角装饰符号，缺省为设计稿的 ⌁ */
  glyph?: ReactNode;
  tint?: ContentCardTint;
  /** 卡片标题的语义级别（h2/h3），按页面已有标题层级选择 */
  headingLevel?: "h2" | "h3";
  /** 站外链接时补充 rel 与提示 */
  external?: boolean;
};

const HeadingTag = {
  h2: "h2",
  h3: "h3",
} as const;

export function ContentCard({
  href,
  title,
  eyebrow,
  description,
  action = "阅读全文",
  glyph = "⌁",
  tint = "blue",
  headingLevel = "h3",
  external = false,
}: ContentCardProps) {
  const Heading = HeadingTag[headingLevel];

  return (
    <article className={`content-card content-card--${tint}`}>
      {eyebrow || glyph ? (
        <div className="content-card__topline">
          {eyebrow ? (
            <span className="content-card__eyebrow">{eyebrow}</span>
          ) : null}
          {glyph ? (
            <span className="content-card__glyph" aria-hidden="true">
              {glyph}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="content-card__body">
        <Heading>
          <Link
            className="content-card__title-link"
            href={href}
            {...(external
              ? { target: "_blank", rel: "nofollow noopener noreferrer" }
              : {})}
          >
            {title}
          </Link>
        </Heading>
        {description ? <p>{description}</p> : null}
      </div>
      <span className="content-card__action" aria-hidden="true">
        {action}
        <span aria-hidden="true">›</span>
      </span>
    </article>
  );
}
