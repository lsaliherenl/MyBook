"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useTransition } from "react";
import { catalogSearch, type CatalogParams } from "@/lib/catalog-params";

interface CatalogNav {
  params: CatalogParams;
  /** Applies a change to the URL state; any filter change goes back to page 1. */
  update: (patch: Partial<CatalogParams>) => void;
  pending: boolean;
}

const Context = createContext<CatalogNav | null>(null);

export function useCatalogNav(): CatalogNav {
  const nav = use(Context);
  if (!nav) throw new Error("useCatalogNav outside CatalogNavProvider");
  return nav;
}

export function CatalogNavProvider({ params, children }: { params: CatalogParams; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<CatalogParams>) => {
    const next = { ...params, page: 1, ...patch };
    startTransition(() => router.push(`${pathname}${catalogSearch(next)}`, { scroll: false }));
  };

  return <Context value={{ params, update, pending }}>{children}</Context>;
}

/** Dims the results while the next page of results is loading. */
export function ResultsFrame({ children, label }: { children: React.ReactNode; label: string }) {
  const { pending } = useCatalogNav();
  return (
    <div aria-busy={pending} aria-label={pending ? label : undefined} className={`min-w-0 flex-[999_1_560px] transition-opacity duration-300 ${pending ? "opacity-50" : ""}`}>
      {children}
    </div>
  );
}
