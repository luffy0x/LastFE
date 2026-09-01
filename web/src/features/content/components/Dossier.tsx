import Link from "next/link";
import { REGIONS } from "@/features/map/regions";
import { SafeMarkdown } from "@/features/markdown/SafeMarkdown";
import { isSafeHttpUrl } from "@/features/submissions/schemas";
import type { ContentRecord } from "../types";

type DossierProps = { record: ContentRecord };

export function Dossier({ record }: DossierProps) {
  const region = REGIONS.find(({ slug }) => slug === record.regionSlug);
  const regionLabel = region?.label ?? "领地";
  const externalUrl =
    record.externalUrl && isSafeHttpUrl(record.externalUrl)
      ? record.externalUrl
      : null;

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
          <SafeMarkdown source={record.markdown} />
        </section>
      ) : null}

      {externalUrl ? (
        <a
          className="dossier__external"
          href={externalUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
        >
          站外链接（本站不托管或检查文件）
        </a>
      ) : null}
    </article>
  );
}
