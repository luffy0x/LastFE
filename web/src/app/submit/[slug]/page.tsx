import Link from "next/link";
import { notFound } from "next/navigation";

import { REGIONS } from "@/features/map/regions";
import { SubmissionForm } from "@/features/submissions/components/SubmissionForm";

export function generateStaticParams() {
  return REGIONS.filter(({ enabled }) => enabled).map(({ slug }) => ({ slug }));
}

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const region = REGIONS.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );
  if (!region) notFound();

  return (
    <main
      id="main-content"
      className="submission-page submission-page--form"
      aria-labelledby="submission-title"
    >
      <nav className="submission-page__back" aria-label="返回导航">
        <Link href="/submit">返回投稿目录</Link>
      </nav>

      <header className="submission-page__header">
        <span>INTAKE / {region.slug.toUpperCase()}</span>
        <h1 id="submission-title">{region.label}投稿</h1>
        <p>{region.description} 请按字段提示整理可公开的信息。</p>
      </header>

      <aside className="submission-safety-note" aria-label="提交前安全检查">
        <strong>提交前检查</strong>
        <p>
          不要提交个人隐私、公司机密、访问凭据或无法公开的面试材料。内容会先进入人工审核，不会直接公开。
        </p>
      </aside>

      <SubmissionForm region={region} />
    </main>
  );
}
