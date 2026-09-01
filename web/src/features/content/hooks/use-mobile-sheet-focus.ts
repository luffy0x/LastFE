import { useEffect } from "react";
import type { RefObject } from "react";

const MOBILE_SHEET_QUERY = "(max-width: 767px)";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useMobileSheetFocus(
  panelRef: RefObject<HTMLElement | null>,
  headingRef: RefObject<HTMLHeadingElement | null>,
) {
  useEffect(() => {
    if (!window.matchMedia?.(MOBILE_SHEET_QUERY).matches) return;

    const panel = panelRef.current;
    const heading = headingRef.current;
    if (!panel || !heading) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    heading.focus({ preventScroll: true });

    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === heading)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener("keydown", containFocus);
    return () => {
      panel.removeEventListener("keydown", containFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [headingRef, panelRef]);
}
