import { Button } from "@/components/Button";
import { GlobalSearch } from "@/features/search/components/GlobalSearch";

export function SearchHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <p className="home-hero__eyebrow">公开、免注册的求职知识库</p>
      <h1 id="home-hero-title">搜索面经、八股、项目与算法，直接抵达内容</h1>
      <p className="home-hero__lede">
        LastFE
        汇集真实面试记录、精选学习资料、高频八股、可复用的项目拆解和算法题解。无需注册即可浏览和搜索全部公开内容。
      </p>
      <div className="home-hero__actions">
        <GlobalSearch variant="hero" />
        <Button href="/submit" variant="secondary" size="large">
          分享你的内容
        </Button>
      </div>
    </section>
  );
}
