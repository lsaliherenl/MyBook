"use client";

import { Check, Heart, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addManyToBag, createList, deleteList, renameList, setInList } from "@/app/[lang]/(site)/list-actions";
import { useBagDrawer } from "../bag/bag-drawer";

const inputClass = "h-12 min-w-0 flex-1 rounded-xs border border-line bg-paper-3 px-3.5 text-[15px] text-ink outline-none focus:border-plum-500";

/** "New list" turns into a name field in place. */
export function NewListButton({ locale, labels }: { locale: string; labels: { newList: string; name: string; create: string; cancel: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createList, { error: null });
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="eyebrow inline-flex h-12 items-center gap-2.5 bg-plum-700 px-5.5 text-[11px] text-paper hover:bg-plum-900">
        <Plus aria-hidden size={16} strokeWidth={1.5} />
        {labels.newList}
      </button>
    );
  }
  return (
    <form action={action} className="flex w-full animate-swap flex-wrap items-center gap-2.5 sm:w-auto">
      <input type="hidden" name="lang" value={locale} />
      <label htmlFor="new-list" className="sr-only">
        {labels.name}
      </label>
      <input id="new-list" name="name" required maxLength={80} autoFocus placeholder={labels.name} aria-invalid={state.error ? true : undefined} className={`${inputClass} sm:w-64`} />
      <button type="submit" disabled={pending} className="eyebrow h-12 bg-plum-700 px-5 text-[11px] text-paper hover:bg-plum-900 disabled:opacity-60">
        {labels.create}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="eyebrow h-12 px-3 text-[11px] text-ink-muted hover:text-ink">
        {labels.cancel}
      </button>
    </form>
  );
}

export function RenameListButton({ listId, name, labels }: { listId: string; name: string; labels: { rename: string; save: string; cancel: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(renameList, { error: null });
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.done) setOpen(false);
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="eyebrow h-10 text-[10.5px] text-ink hover:text-plum-500">
        {labels.rename}
      </button>
    );
  }
  return (
    <form action={action} className="flex w-full animate-swap items-center gap-2.5">
      <input type="hidden" name="listId" value={listId} />
      <label htmlFor="rename-list" className="sr-only">
        {labels.name}
      </label>
      <input id="rename-list" name="name" required maxLength={80} defaultValue={name} autoFocus className={inputClass} />
      <button type="submit" disabled={pending} className="eyebrow h-12 bg-plum-700 px-5 text-[11px] text-paper disabled:opacity-60">
        {labels.save}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="eyebrow h-12 px-3 text-[11px] text-ink-muted">
        {labels.cancel}
      </button>
    </form>
  );
}

export function DeleteListButton({ listId, locale, label, confirmText }: { listId: string; locale: string; label: string; confirmText: string }) {
  return (
    <form action={deleteList} onSubmit={(e) => !window.confirm(confirmText) && e.preventDefault()}>
      <input type="hidden" name="listId" value={listId} />
      <input type="hidden" name="lang" value={locale} />
      <button type="submit" className="eyebrow h-10 text-[10.5px] text-overdue hover:text-plum-900">
        {label}
      </button>
    </form>
  );
}

/** The plum heart on a cover: takes the book off the list. */
export function RemoveFromListButton({ listId, bookId, label }: { listId: string; bookId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => startTransition(async () => void (await setInList(listId, bookId, false)))}
      className="group absolute top-1.5 right-1.5 inline-flex size-8.5 items-center justify-center rounded-full bg-paper-3/92 text-plum-700 hover:bg-paper-3 disabled:opacity-50"
    >
      <Heart aria-hidden size={16} strokeWidth={1.5} className="fill-plum-700 group-hover:animate-icon-beat group-hover:fill-transparent" />
    </button>
  );
}

export function AddAvailableToBag({ bookIds, label }: { bookIds: string[]; label: string }) {
  const { setOpen } = useBagDrawer();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await addManyToBag(bookIds);
          setOpen(true);
        })
      }
      className="eyebrow h-10 pl-1 text-[10.5px] text-plum-700 underline underline-offset-5 hover:text-plum-900 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

/** Book page: a small menu of the member's lists with a tick on the ones that hold this book. */
export function SaveToListMenu({
  bookId,
  lists,
  initial,
  labels,
  manageHref,
}: {
  bookId: string;
  lists: { id: string; name: string }[];
  initial: string[];
  labels: { saveToList: string; savedIn: string; manageLists: string };
  manageHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [inLists, setInLists] = useState(initial);
  const [, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = (id: string) => {
    const add = !inLists.includes(id);
    setInLists(add ? [...inLists, id] : inLists.filter((x) => x !== id));
    startTransition(async () => {
      const result = await setInList(id, bookId, add);
      if (result.error) setInLists((now) => (add ? now.filter((x) => x !== id) : [...now, id]));
    });
  };

  return (
    <div ref={box} className="relative self-start">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="group inline-flex h-11 items-center gap-2.5 text-[15px] text-ink hover:text-plum-500">
        <Heart aria-hidden size={20} strokeWidth={1.5} className={`group-hover:animate-icon-beat ${inLists.length ? "fill-plum-700 text-plum-700" : ""}`} />
        {inLists.length ? labels.savedIn.replace("{count}", String(inLists.length)) : labels.saveToList}
      </button>
      {open && (
        <div className="absolute top-full left-0 z-40 flex w-68 animate-drop flex-col border border-line bg-paper-3 py-2 shadow-pop">
          {lists.map((list) => {
            const checked = inLists.includes(list.id);
            return (
              <button key={list.id} type="button" role="menuitemcheckbox" aria-checked={checked} onClick={() => toggle(list.id)} className="flex items-center gap-3 px-4.5 py-2.5 text-left text-[15px] hover:bg-paper-2">
                <span className={`inline-flex size-4.5 flex-none items-center justify-center rounded-xs ${checked ? "bg-plum-700 text-paper" : "border border-ink-muted"}`}>
                  {checked && <Check aria-hidden size={12} strokeWidth={2} />}
                </span>
                {list.name}
              </button>
            );
          })}
          <Link href={manageHref} className="eyebrow mt-1 border-t border-line px-4.5 pt-3 pb-1.5 text-[10px] text-plum-500 no-underline hover:text-plum-700">
            {labels.manageLists}
          </Link>
        </div>
      )}
    </div>
  );
}
