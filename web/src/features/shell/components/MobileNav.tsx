"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { CategoryDefinition } from "@/features/content/categories";

type MobileNavProps = {
  categories: readonly CategoryDefinition[];
};

export function MobileNav({ categories }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const firstLink = panelRef.current?.querySelector("a");
    firstLink?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="mobile-nav">
      <button
        ref={triggerRef}
        type="button"
        className="mobile-nav__trigger"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <Menu size={20} aria-hidden="true" />
        )}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id="mobile-nav-panel"
          className="mobile-nav__panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          <nav className="site-container" aria-label="移动端分类导航">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={category.href}
                onClick={() => setOpen(false)}
              >
                {category.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
