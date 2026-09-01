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

export function useGlobalSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [groups, setGroups] = useState<readonly SearchGroup[]>([]);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      setState("loading");
      setIsOpen(true);
    }
    dialog.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  const restoreTrigger = useCallback(() => {
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
    setGroups([]);
    setState("loading");
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
    if (!isOpen) return;
    const controller = new AbortController();
    void request<SearchResponse>(
      `/api/search?q=${encodeURIComponent(deferredQuery)}`,
      { signal: controller.signal },
    )
      .then((response) => {
        setGroups(response.groups);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGroups([]);
        setState("error");
      });
    return () => controller.abort();
  }, [deferredQuery, isOpen]);

  return {
    close,
    deferredQuery,
    dialogRef,
    groups,
    isOpen,
    open,
    query,
    restoreTrigger,
    state,
    triggerRef,
    updateQuery,
  };
}
