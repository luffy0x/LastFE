import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmissionForm } from "@/features/content/components/SubmissionForm";
import { REGIONS } from "@/features/map/regions";

export function generateStaticParams() {
  return REGIONS.filter(({ enabled }) => enabled).map(({ slug }) => ({ slug }));
}

export default async function SubmitRegionPage({
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
    <main id="main-content" className="submission-page">
      <section className="submission-shell">
        <nav className="dossier__nav" aria-label="投稿路径">
          <Link href="/">战略地图</Link>
          <span aria-hidden="true">/</span>
          <Link href="/submit">选择领地</Link>
        </nav>
        <p className="submission-eyebrow">INTEL DROP / {region.slug.toUpperCase()}</p>
        <h1>向{region.label}递交情报</h1>
        <p>
          内容不会直接公开。我们会把它封装成审核 Issue，批准后同步到 Supabase。
        </p>
        <SubmissionForm region={region} />
      </section>
    </main>
  );
}
