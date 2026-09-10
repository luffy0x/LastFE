import Link from "next/link";

import { CATEGORIES } from "@/features/content/categories";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__inner">
        <div>
          <p className="site-footer__brand">LastFE</p>
          <p>公开、免注册的求职知识库。投稿经维护者审核后发布。</p>
        </div>
        <nav className="site-footer__nav" aria-label="页脚导航">
          {CATEGORIES.filter(({ enabled }) => enabled).map((category) => (
            <Link key={category.slug} href={category.href}>
              {category.label}
            </Link>
          ))}
          <Link href="/submit">投稿</Link>
        </nav>
      </div>
    </footer>
  );
}
