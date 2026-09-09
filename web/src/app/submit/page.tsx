import Link from "next/link";

import { CATEGORIES } from "@/features/content/categories";

export default function SubmitPage() {
  const categories = CATEGORIES.filter(({ enabled }) => enabled);

  return (
    <main
      id="main-content"
      className="submission-page site-container"
      aria-labelledby="submission-directory-title"
    >
      <nav className="breadcrumb" aria-label="面包屑">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">投稿</span>
      </nav>

      <header className="category-page__header">
        <h1 id="submission-directory-title">选择投稿分类</h1>
        <p>选择与你的内容最贴近的分类后提交。内容不会直接公开，审核通过后才会出现。</p>
      </header>

      <div className="submission-directory" role="list">
        {categories.map((category) => (
          <section
            key={category.slug}
            className="submission-directory__item"
            role="listitem"
          >
            <div>
              <h2>{category.label}</h2>
              <p>{category.description}</p>
            </div>
            <Link
              className="button-primary"
              href={`/submit/${category.slug}`}
            >
              投稿{category.label}
            </Link>
          </section>
        ))}
      </div>

      <aside className="submission-safety-note" aria-label="投稿安全说明">
        <strong>公开边界</strong>
        <p>请移除姓名、电话、邮箱、内部链接、密钥及其他不应公开的信息。</p>
      </aside>
    </main>
  );
}
