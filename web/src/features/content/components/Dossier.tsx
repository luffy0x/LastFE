import Link from "next/link";

import { CATEGORIES } from "@/features/content/categories";
import { MarkdownRender } from "@/features/markdown/MarkdownRender";
import { isSafeHttpUrl } from "@/utils/url";

import type { ContentRecord } from "../types";

type DossierProps = { record: ContentRecord };

export function Dossier({ record }: DossierProps) {
  const category = CATEGORIES.find(({ slug }) => slug === record.regionSlug);
  const categoryLabel = category?.label ?? "分类";
  const externalUrl =
    record.externalUrl && isSafeHttpUrl(record.externalUrl)
      ? record.externalUrl
      : null;

  return (
    <article className="dossier">
      <nav aria-label="面包屑" className="breadcrumb">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/regions/${record.regionSlug}`}>{categoryLabel}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">正文</span>
      </nav>

      <header className="dossier__header">
        <h1>{record.title}</h1>
        {record.summary ? <p>{record.summary}</p> : null}
      </header>

      {record.tags.length > 0 ? (
        <ul className="tag-list dossier__tags" aria-label="标签">
          {record.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}

      {record.markdown ? (
        <section className="dossier__body" aria-label="内容正文">
          <MarkdownRender content={record.markdown} />
        </section>
      ) : null}

      {externalUrl ? (
        <a
          className="dossier__external"
          href={externalUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
        >
          访问站外链接（本站不托管或检查文件）
        </a>
      ) : null}

      <footer className="dossier__footer">
        <Link
          className="button-secondary"
          href={`/regions/${record.regionSlug}`}
        >
          返回{categoryLabel}
        </Link>
        <Link
          className="button-secondary"
          href={`/submit/${record.regionSlug}`}
        >
          向{categoryLabel}投稿
        </Link>
      </footer>
    </article>
  );
}
