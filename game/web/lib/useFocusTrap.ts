"use client";
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open overlays, newest last: only the top one handles Tab (a ledger picker over the spotlight).
const stack: object[] = [];

/** Keep Tab inside an overlay while it's open, start focus inside it, and give focus back to
 *  whatever had it when the overlay closes. Put the returned ref on the overlay's root. */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const token = {};
    stack.push(token);
    const before = document.activeElement as HTMLElement | null;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    if (!root.contains(document.activeElement)) (items()[0] ?? root).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || stack[stack.length - 1] !== token) return;
      const list = items();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const at = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (at === first || !root.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !root.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      if (before && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [active]);
  return ref;
}
