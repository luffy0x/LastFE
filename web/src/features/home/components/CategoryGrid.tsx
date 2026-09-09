import {
  BookOpen,
  Briefcase,
  Code2,
  FolderGit2,
  Layers,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import type { CategoryDefinition } from "@/features/content/categories";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  interview: Briefcase,
  resources: BookOpen,
  fundamentals: Layers,
  projects: FolderGit2,
  algorithms: Code2,
};

type CategoryGridProps = {
  categories: readonly CategoryDefinition[];
};

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className="category-grid">
      {categories.map((category) => {
        const Icon = CATEGORY_ICONS[category.slug] ?? Layers;
        return (
          <Link
            key={category.slug}
            href={category.href}
            className="category-card"
          >
            <Icon size={22} aria-hidden="true" />
            <h3>{category.label}</h3>
            <p>{category.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
