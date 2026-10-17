"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False while prerendering and hydrating, true in the browser afterwards; for values that depend on "now". */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
