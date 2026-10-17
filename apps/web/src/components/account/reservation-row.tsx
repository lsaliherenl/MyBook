import Link from "next/link";
import type { ReservationDto } from "@mybook/shared";
import type { Locale } from "@/i18n/config";
import { format, type Dictionary } from "@/i18n/get-dictionary";
import { formatShortDate } from "@/lib/format";

/** Books reserved together share a pickup code; the account pages show them as one row. */
export interface ReservationGroup {
  code: string;
  reservations: ReservationDto[];
  status: ReservationDto["status"];
}

const OPEN = new Set(["READY", "PENDING"]);

/** Groups by pickup code: open groups first (ready before queued), then the most recent closed ones. */
export function groupReservations(reservations: ReservationDto[]): ReservationGroup[] {
  const byCode = new Map<string, ReservationDto[]>();
  for (const r of reservations) byCode.set(r.code, [...(byCode.get(r.code) ?? []), r]);
  const groups = [...byCode.entries()].map(([code, list]) => {
    const status = list.some((r) => r.status === "READY")
      ? "READY"
      : list.some((r) => r.status === "PENDING")
        ? "PENDING"
        : list.some((r) => r.status === "FULFILLED")
          ? "FULFILLED"
          : list[0].status;
    return { code, reservations: list, status } satisfies ReservationGroup;
  });
  const rank = (g: ReservationGroup) => (g.status === "READY" ? 0 : g.status === "PENDING" ? 1 : 2);
  return groups.sort((a, b) => rank(a) - rank(b) || b.reservations[0].createdAt.localeCompare(a.reservations[0].createdAt));
}

const STEP: Partial<Record<ReservationDto["status"], number>> = { PENDING: 2, READY: 3 };

export function ReservationRow({ group, t, locale, pickupHours }: { group: ReservationGroup; t: Dictionary; locale: Locale; pickupHours: number }) {
  const a = t.account;
  const open = OPEN.has(group.status);
  const first = group.reservations[0];
  const titles = group.reservations.map((r) => r.book.title).join(", ");
  const step = STEP[group.status];
  const ids = group.reservations.filter((r) => OPEN.has(r.status)).map((r) => r.id);
  const badge =
    group.status === "READY"
      ? "bg-ready-bg text-ready"
      : group.status === "PENDING"
        ? "border border-line text-ink-muted"
        : group.status === "FULFILLED"
          ? "bg-available-bg text-available"
          : "bg-stone-bg text-stone";
  const detail =
    group.status === "EXPIRED"
      ? ` · ${format(a.notCollected, { hours: String(pickupHours) })}`
      : "";
  const closed = formatShortDate(first.closedAt ?? first.createdAt, locale);
  const when =
    group.status === "FULFILLED" ? format(a.collectedOn, { date: closed }) : group.status === "CANCELLED" ? format(a.cancelledOn, { date: closed }) : closed;

  return (
    <div className={`flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line py-5.5 ${open ? "" : "text-ink-muted"}`}>
      <span className="w-30 font-medium tracking-[.06em]">{group.code}</span>
      <span className="min-w-0 flex-[1_1_220px] text-[15px]">
        {titles}
        {detail}
      </span>
      {step ? (
        <span aria-label={format(a.stepLabel, { step: String(step), status: a.reservationStatus[group.status] })} className="flex w-32.5 items-center gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-0.75 w-7 ${i < step ? "bg-plum-700" : i === step ? "bg-gold" : "bg-line"}`} />
          ))}
        </span>
      ) : (
        <span className="w-32.5 text-[13px]">{when}</span>
      )}
      <span className="w-37.5">
        <span className={`eyebrow px-2 py-1.25 text-[10px] ${badge}`}>
          {group.status === "PENDING" && first.queuePosition ? `${a.reservationStatus.PENDING} · ${first.queuePosition}.` : a.reservationStatus[group.status]}
        </span>
      </span>
      {open ? (
        <Link href={`/${locale}/reservations/confirmed?ids=${ids.join(",")}`} className="eyebrow text-[11px] text-ink no-underline hover:text-plum-500">
          {a.pickupPass}
        </Link>
      ) : group.status === "EXPIRED" || group.status === "CANCELLED" ? (
        <Link href={`/${locale}/books/${first.book.slug}`} className="eyebrow text-[11px] text-ink no-underline hover:text-plum-500">
          {a.reserveAgain}
        </Link>
      ) : (
        <span className="w-23" />
      )}
    </div>
  );
}
