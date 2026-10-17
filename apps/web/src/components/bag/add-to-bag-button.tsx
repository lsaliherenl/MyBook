"use client";

import { useState, useTransition } from "react";
import { addToBag } from "@/app/[lang]/(site)/bag-actions";
import { useBagDrawer } from "./bag-drawer";

/** Adds a book to the borrow bag and opens the drawer so the reader sees where it went. */
export function AddToBagButton({
  bookId,
  inBag,
  label,
  inBagLabel,
  fullLabel,
  className,
}: {
  bookId: string;
  inBag: boolean;
  label: string;
  inBagLabel: string;
  fullLabel: string;
  className: string;
}) {
  const { setOpen } = useBagDrawer();
  const [pending, startTransition] = useTransition();
  const [full, setFull] = useState(false);

  if (inBag) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {inBagLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={pending || full}
      onClick={() =>
        startTransition(async () => {
          const result = await addToBag(bookId);
          if (result.full) setFull(true);
          if (result.ok) setOpen(true);
        })
      }
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      {full ? fullLabel : label}
    </button>
  );
}
