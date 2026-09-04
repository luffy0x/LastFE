import Link from "next/link";
import { REGIONS } from "@/features/map/regions";

export default function SubmitIndexPage() {
  return (
    <main id="main-content" className="submission-page">
      <section className="submission-shell">
        <p className="submission-eyebrow">SUBMISSION CHANNEL</p>
        <h1>选择要递交情报的领地</h1>
        <p>
          投稿会先进入私有 GitHub Issues 审核队列；维护者批准后，内容才会公开到地图。
        </p>
        <div className="submission-region-grid">
          {REGIONS.filter((region) => region.enabled).map((region) => (
            <Link key={region.slug} href={`/submit/${region.slug}`}>
              <span>{region.label}</span>
              <small>{region.description}</small>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
