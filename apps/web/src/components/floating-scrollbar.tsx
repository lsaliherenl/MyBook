"use client";

import { useEffect, useRef } from "react";

/**
 * The page's native scrollbar is hidden (globals.css); this thin plum thumb floats over the page instead,
 * shows only while scrolling, fades out ~0.9 s later and can be dragged. Inner scroll areas get the
 * `is-scrolling` class while they move so their own thin bar shows up briefly.
 */
export function FloatingScrollbar() {
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = thumb.current;
    if (!el) return;
    const root = () => document.scrollingElement ?? document.documentElement;
    const timers = new WeakMap<Element, number>();
    let hideTimer = 0;
    let drag: { y: number; top: number } | null = null;

    const metrics = () => {
      const page = root();
      const viewport = window.innerHeight;
      const height = Math.max(40, (viewport * viewport) / page.scrollHeight);
      return { page, viewport, height, room: page.scrollHeight - viewport };
    };

    const place = () => {
      const { page, viewport, height, room } = metrics();
      if (room < 1) {
        el.style.display = "none";
        return false;
      }
      el.style.display = "";
      el.style.height = `${height}px`;
      el.style.transform = `translateY(${(page.scrollTop / room) * (viewport - height - 4) + 2}px)`;
      return true;
    };

    const show = () => {
      if (!place()) return;
      el.dataset.on = "true";
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (!drag) delete el.dataset.on;
      }, 900);
    };

    const onScroll = (event: Event) => {
      if (event.target === document) return show();
      const target = event.target as Element | null;
      if (!target?.classList) return;
      target.classList.add("is-scrolling");
      window.clearTimeout(timers.get(target));
      timers.set(target, window.setTimeout(() => target.classList.remove("is-scrolling"), 900));
    };

    const onDown = (e: PointerEvent) => {
      drag = { y: e.clientY, top: root().scrollTop };
      el.dataset.drag = "true";
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const { page, viewport, height, room } = metrics();
      page.scrollTo({ top: drag.top + ((e.clientY - drag.y) * room) / Math.max(1, viewport - height - 4), behavior: "instant" });
    };
    const onUp = () => {
      drag = null;
      delete el.dataset.drag;
      show();
    };

    place();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", place);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", place);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      window.clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div
      ref={thumb}
      aria-hidden="true"
      className="group fixed top-0 right-0.5 z-[2147483000] h-10 w-3 touch-none opacity-0 transition-opacity duration-300 data-on:opacity-100 data-drag:opacity-100"
    >
      <span className="absolute inset-y-0 right-0.5 w-1.5 rounded bg-plum-900/62 transition-[width] group-hover:w-2 group-data-drag:w-2" />
    </div>
  );
}
