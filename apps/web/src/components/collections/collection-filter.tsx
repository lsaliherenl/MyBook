"use client";

import { useState } from "react";

/** "All · Course reserves · Literature…" chips over the collection grid; filtering happens in the browser. */
export function CollectionFilter({
  label,
  chips,
  cards,
  empty,
}: {
  label: string;
  chips: { kind: string; label: string }[];
  cards: { id: string; kind: string; card: React.ReactNode }[];
  empty: string;
}) {
  const [kind, setKind] = useState("ALL");
  const shown = cards.filter((c) => kind === "ALL" || c.kind === kind);
  return (
    <>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const on = chip.kind === kind;
          return (
            <button
              key={chip.kind}
              type="button"
              aria-pressed={on}
              onClick={() => setKind(chip.kind)}
              className={`h-9.5 border px-4 text-sm ${on ? "border-ink bg-ink text-paper" : "border-line bg-transparent text-ink hover:border-ink"}`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      {/* Full width under the heading and the chips (the parent row wraps). */}
      <div className="order-last mt-3 w-full">
        {shown.length ? (
          <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => (
              <div key={c.id} className="animate-swap">
                {c.card}
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 animate-swap py-14 text-center text-[15px] text-ink-muted">{empty}</p>
        )}
      </div>
    </>
  );
}
