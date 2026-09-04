"use client";

import Link from "next/link";

import { REGIONS } from "@/features/map/regions";
import { useGlobalSearch } from "./useGlobalSearch";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m15.5 15.5 5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function GlobalSearch() {
  const {
    close,
    dialogRef,
    groups,
    isOpen,
    open,
    query,
    restoreTrigger,
    state,
    triggerRef,
    updateQuery,
  } = useGlobalSearch();

  return (
    <>
      <div className="global-search">
        <button
          ref={triggerRef}
          type="button"
          aria-label="打开全局搜索"
          aria-controls="global-search-dialog"
          aria-expanded={isOpen}
          onClick={open}
        >
          <SearchIcon />
          <span>检索全部情报</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        id="global-search-dialog"
        className="global-search-dialog"
        aria-labelledby="global-search-title"
        onClose={restoreTrigger}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          close();
        }}
      >
        <header className="global-search-dialog__header">
          <div>
            <span>INDEX / PUBLIC</span>
            <h2 id="global-search-title">全局情报检索</h2>
          </div>
          <button type="button" aria-label="关闭全局搜索" onClick={close}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M5 5l14 14M19 5 5 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </header>

        <form
          className="global-search-dialog__form"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="global-search-query">搜索全部公开情报</label>
          <input
            id="global-search-query"
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.currentTarget.value)}
            autoComplete="off"
            placeholder="标题、标签、正文或领地字段"
          />
        </form>

        <div className="global-search-dialog__status" aria-live="polite">
          {state === "loading" ? "正在扫描公开索引…" : null}
          {state === "error" ? (
            <p role="alert">搜索暂时不可用，请稍后重试。</p>
          ) : null}
          {state === "ready" && groups.length === 0 ? (
            <p>没有找到公开情报，请调整关键词。</p>
          ) : null}
        </div>

        <div className="global-search-dialog__results">
          {state === "ready"
            ? groups.map((group) => {
                const region = REGIONS.find(
                  ({ slug }) => slug === group.regionSlug,
                );
                return (
                  <section
                    key={group.regionSlug}
                    aria-labelledby={`search-group-${group.regionSlug}`}
                  >
                    <h3 id={`search-group-${group.regionSlug}`}>
                      {region?.label ?? group.regionSlug}
                    </h3>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.id}>
                          <Link href={`/content/${item.id}`} onClick={close}>
                            <span>{item.title}</span>
                            <small>{item.tags.join(" / ")}</small>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            : null}
        </div>
      </dialog>
    </>
  );
}
