import Link from "next/link";
import { notFound } from "next/navigation";

import { CATEGORIES } from "@/features/content/categories";
import { SubmissionForm } from "@/features/content/components/SubmissionForm";

export function generateStaticParams() {
  return CATEGORIES.filter(({ enabled }) => enabled).map(({ slug }) => ({
    slug,
  }));
}

export default async function SubmitCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = CATEGORIES.find(
    (candidate) => candidate.slug === slug && candidate.enabled,
  );
  if (!category) notFound();

  return (
    <main id="main-content" className="submission-page site-container">
      <nav className="breadcrumb" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href="/submit">投稿</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{category.label}</span>
      </nav>
      <section className="submission-shell">
        <h1>向{category.label}投稿</h1>
        <p>
          内容不会直接公开。提交后会进入审核队列，由维护者批准后同步发布。
        </p>
        <SubmissionForm category={category} />
      </section>
    </main>
  );
}
