"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import type { SearchGroup } from "@/server/content/search";
import { request } from "@/utils/request";

type SearchResponse = { groups: readonly SearchGroup[] };
type SettledSearch = SearchResponse & {
  query: string;
  state: "ready" | "error";
};

export function useGlobalSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestGenerationRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [settledSearch, setSettledSearch] = useState<SettledSearch | null>(null);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      setIsOpen(true);
    }
    dialog.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  const restoreTrigger = useCallback(() => {
    requestGenerationRef.current += 1;
    setSettledSearch(null);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    restoreTrigger();
  }, [restoreTrigger]);

  const updateQuery = (value: string) => {
    setQuery(value);
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [open]);

  useEffect(() => {
    if (!isOpen || settledSearch?.query === deferredQuery) return;
    const controller = new AbortController();
    const requestGeneration = requestGenerationRef.current;
    void request<SearchResponse>(
      `/api/search?q=${encodeURIComponent(deferredQuery)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (requestGeneration !== requestGenerationRef.current) return;
        setSettledSearch({
          groups: response.groups,
          query: deferredQuery,
          state: "ready",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestGeneration !== requestGenerationRef.current) return;
        setSettledSearch({ groups: [], query: deferredQuery, state: "error" });
      });
    return () => controller.abort();
  }, [deferredQuery, isOpen, settledSearch?.query]);

  const isDeferring = query !== deferredQuery;
  const state = !isOpen
    ? "idle"
    : isDeferring && settledSearch
      ? settledSearch.state
      : settledSearch?.query === deferredQuery
        ? settledSearch.state
        : "loading";

  return {
    close,
    deferredQuery,
    dialogRef,
    groups: settledSearch?.groups ?? [],
    isOpen,
    open,
    query,
    restoreTrigger,
    state,
    triggerRef,
    updateQuery,
  };
}
