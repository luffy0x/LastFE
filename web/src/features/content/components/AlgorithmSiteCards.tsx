import { ALGORITHM_SITES } from "../site-icons";

/** 「算法手撕」分区顶部的静态刷题站点推荐卡片 */
export function AlgorithmSiteCards() {
  return (
    <section className="algorithm-site-cards" aria-label="刷题网站推荐">
      <h2>刷题网站推荐</h2>
      <div className="algorithm-site-cards__grid">
        {ALGORITHM_SITES.map(({ site, description, icon, url, labels }) => (
          <a
            key={site}
            className="algorithm-site-card"
            href={url}
            target="_blank"
            rel="nofollow noopener noreferrer"
          >
            <span className="algorithm-site-card__icon" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- 小尺寸静态 favicon，无需 next/image 优化管线 */}
              <img src={icon} alt="" width={40} height={40} loading="lazy" />
            </span>
            <span className="algorithm-site-card__body">
              <span className="algorithm-site-card__site">{site}</span>
              <span className="algorithm-site-card__description">
                {description}
              </span>
              <ul className="algorithm-site-card__labels">
                {labels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
