import Link from "next/link";

export default function SubmittedPage() {
  return (
    <main
      id="main-content"
      className="submission-page submission-page--complete"
      aria-labelledby="submitted-title"
    >
      <div className="submission-complete">
        <span>INTAKE / RECEIVED</span>
        <h1 id="submitted-title">投稿已进入审核队列</h1>
        <p>
          内容不会立即公开。维护者会检查隐私、安全性与内容质量，通过后才会出现在对应领地。
        </p>
        <div className="submission-complete__actions">
          <Link className="submission-primary-link" href="/">
            返回战略地图
          </Link>
          <Link className="submission-secondary-link" href="/submit">
            继续投稿
          </Link>
        </div>
      </div>
    </main>
  );
}
