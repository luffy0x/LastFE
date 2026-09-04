import Link from "next/link";

export default function SubmittedPage() {
  return (
    <main id="main-content" className="submission-page">
      <section className="submission-shell submission-shell--compact">
        <p className="submission-eyebrow">QUEUE CONFIRMED</p>
        <h1>情报已进入审核队列</h1>
        <p>
          维护者会在私有 GitHub Issues 中审核。通过后，它会同步到 Supabase 并出现在公开地图里。
        </p>
        <Link className="submission-primary-link" href="/">
          返回战略地图
        </Link>
      </section>
    </main>
  );
}
