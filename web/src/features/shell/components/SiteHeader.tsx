import { Compass } from "lucide-react";
import Link from "next/link";

import { CATEGORIES } from "@/features/content/categories";
import { GlobalSearch } from "@/features/search/components/GlobalSearch";

import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

const enabledCategories = CATEGORIES.filter(({ enabled }) => enabled);

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link href="/" className="site-header__brand">
          <Compass size={20} aria-hidden="true" />
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
          <Link href="/submit" className="site-header__submit">
            投稿
          </Link>
          <MobileNav categories={enabledCategories} />
        </div>
      </div>
    </header>
  );
}
