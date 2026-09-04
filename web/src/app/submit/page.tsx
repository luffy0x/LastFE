import Link from "next/link";

import { REGIONS } from "@/features/map/regions";

export default function SubmitPage() {
  const regions = REGIONS.filter(({ enabled }) => enabled);

  return (
    <main
      id="main-content"
      className="submission-page"
      aria-labelledby="submission-directory-title"
      aria-label="选择投稿领地"
    >
      <nav className="submission-page__back" aria-label="返回导航">
        <Link href="/">返回战略地图</Link>
      </nav>

      <header className="submission-page__header">
        <span>INTAKE / TERRITORY INDEX</span>
        <h1 id="submission-directory-title">选择投稿领地</h1>
        <p>
          每份情报只进入一个领地。选择最贴近内容主题的入口，提交后将由维护者人工审核。
        </p>
      </header>

      <nav className="submission-directory" aria-label="投稿领地目录">
        <ol>
          {regions.map((region, index) => (
            <li key={region.slug}>
              <span className="submission-directory__index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="submission-directory__code">
                  SECTOR / {region.slug.toUpperCase()}
                </span>
                <h2>{region.label}</h2>
                <p>{region.description}</p>
              </div>
              <Link href={`/submit/${region.slug}`}>
                进入{region.label}投稿表
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <aside className="submission-safety-note" aria-label="投稿安全说明">
        <strong>公开边界</strong>
        <p>请移除姓名、电话、邮箱、内部链接、密钥及其他不应公开的信息。</p>
      </aside>
    </main>
  );
}
