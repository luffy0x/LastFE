"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { request, RequestError } from "@/utils/request";
import type { ContentSummary, Page } from "@/features/content/types";

type SearchResponse = {
  ok: true;
  page: Page<ContentSummary>;
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly ContentSummary[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (!term) {
      setMessage("输入关键词后开始检索");
      setResults([]);
      return;
    }

    setPending(true);
    setMessage("正在扫描公开情报…");
    try {
      const response = await request<SearchResponse>(
        `/api/search?q=${encodeURIComponent(term)}`,
      );
      setResults(response.page.items);
      setMessage(
        response.page.total === 0
          ? "没有匹配的公开情报"
          : `找到 ${response.page.total} 份公开情报`,
      );
    } catch (error) {
      setResults([]);
      setMessage(
        error instanceof RequestError
          ? error.message
          : "搜索暂时不可用，请稍后重试",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="global-search" aria-label="全局搜索">
      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="global-search-query">
          全局搜索关键词
        </label>
        <input
          id="global-search-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索公司、标签、项目、题解…"
        />
        <button type="submit" disabled={pending}>
          {pending ? "搜索中" : "搜索情报"}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {results.length ? (
        <ul className="global-search__results" aria-label="搜索结果">
          {results.map((item) => (
            <li key={item.id}>
              <Link href={`/content/${item.id}`}>{item.title}</Link>
              <span>{item.regionSlug}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
