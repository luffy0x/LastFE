import { connection } from "next/server";

import { CATEGORIES } from "@/features/content/categories";
import { getContentRepository } from "@/features/content/repository";
import { CategoryGrid } from "@/features/home/components/CategoryGrid";
import { LatestContent } from "@/features/home/components/LatestContent";
import { SearchHero } from "@/features/home/components/SearchHero";
import { SubmissionGuide } from "@/features/home/components/SubmissionGuide";

export default async function HomePage() {
  await connection();
  const repository = getContentRepository();
  const [stats, latest] = await Promise.all([
    repository.stats(),
    repository.list({ page: 1, pageSize: 20 }),
  ]);

  return (
    <main id="main-content" aria-label="首页">
      <div className="site-container">
        <SearchHero />
        <section className="home-stats" aria-label="内容统计">
          <div>
            <output>{stats.totalPublished}</output>
            <span>公开内容</span>
          </div>
          <div>
            <output>{stats.recentPublished}</output>
            <span>近七日新增</span>
          </div>
        </section>
        <section className="home-section" aria-labelledby="home-categories">
          <div className="home-section__header">
            <h2 id="home-categories">内容分类</h2>
          </div>
          <CategoryGrid
            categories={CATEGORIES.filter(({ enabled }) => enabled)}
          />
        </section>
        <section className="home-section" aria-labelledby="home-latest">
          <div className="home-section__header">
            <h2 id="home-latest">最新内容</h2>
          </div>
          <LatestContent items={latest.items.slice(0, 10)} />
        </section>
        <section className="home-section" aria-label="投稿说明">
          <SubmissionGuide />
        </section>
      </div>
    </main>
  );
}
