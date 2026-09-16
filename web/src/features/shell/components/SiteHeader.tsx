import Link from "next/link";

import { Button } from "@/components/Button";
import { CATEGORIES } from "@/features/content/categories";
import { GlobalSearch } from "@/features/search/components/GlobalSearch";

import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

const enabledCategories = CATEGORIES.filter(({ enabled }) => enabled);

function ConstellationCompass() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="20"
      height="20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.72"
      >
        <line x1="16" y1="8" x2="19" y2="13" />
        <line x1="19" y1="13" x2="25" y2="14" />
        <line x1="25" y1="14" x2="20" y2="18" />
        <line x1="20" y1="18" x2="22" y2="24" />
        <line x1="22" y1="24" x2="16" y2="20" />
        <line x1="16" y1="20" x2="10" y2="24" />
        <line x1="10" y1="24" x2="12" y2="18" />
        <line x1="12" y1="18" x2="7" y2="14" />
        <line x1="7" y1="14" x2="13" y2="13" />
        <line x1="13" y1="13" x2="16" y2="8" />
      </g>
      <g fill="currentColor" opacity="0.86">
        <circle cx="16" cy="8" r="1.5" />
        <circle cx="25" cy="14" r="1.5" />
        <circle cx="22" cy="24" r="1.5" />
        <circle cx="10" cy="24" r="1.5" />
        <circle cx="7" cy="14" r="1.5" />
      </g>
      <circle cx="16" cy="16" r="1.3" fill="currentColor" opacity="0.48" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link href="/" className="site-header__brand">
          <ConstellationCompass />
          LastFE
        </Link>
        <nav className="site-header__nav" aria-label="主导航">
          {enabledCategories.map((category) => (
            <Link key={category.slug} href={category.href}>
              {category.label}
            </Link>
          ))}
        </nav>
        <div className="site-header__actions">
          <GlobalSearch />
          <ThemeToggle />
          <Button href="/submit" arrow={false} className="site-header__submit">
            投稿
          </Button>
          <MobileNav categories={enabledCategories} />
        </div>
      </div>
    </header>
  );
}
