import Link from "next/link";
import { REGIONS } from "@/features/map/regions";
import type { ContentRecord } from "../types";

type DossierProps = { record: ContentRecord };

function MarkdownBody({ markdown }: { markdown: string }) {
  return markdown.split("\n\n").map((block, index) => {
    if (block.startsWith("## ")) {
      return <h2 key={`${block}-${index}`}>{block.slice(3)}</h2>;
    }
    return <p key={`${block}-${index}`}>{block}</p>;
  });
}

export function Dossier({ record }: DossierProps) {
  const region = REGIONS.find(({ slug }) => slug === record.regionSlug);
  const regionLabel = region?.label ?? "领地";

  return (
    <article className="dossier">
      <nav aria-label="档案路径" className="dossier__nav">
        <Link href="/">战略地图</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/regions/${record.regionSlug}`}>返回{regionLabel}</Link>
      </nav>

      <header className="dossier__header">
        <span>DOSSIER / {record.id.toUpperCase()}</span>
        <h1>{record.title}</h1>
        {record.summary ? <p>{record.summary}</p> : null}
      </header>

      <dl className="dossier__metadata">
        <div>
          <dt>记录者</dt>
          <dd>{record.nickname ?? "匿名"}</dd>
        </div>
        {Object.entries(record.metadata).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <ul className="dossier__tags" aria-label="标签">
        {record.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>

      {record.markdown ? (
        <section className="dossier__body" aria-label="档案正文">
          <MarkdownBody markdown={record.markdown} />
        </section>
      ) : null}

      {record.externalUrl ? (
        <a
          className="dossier__external"
          href={record.externalUrl}
          target="_blank"
          rel="noreferrer"
        >
          打开外部链接
          <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </article>
  );
}
