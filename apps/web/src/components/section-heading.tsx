import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Eyebrow + serif heading, with an optional "View all →" link on the right. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  link,
  size = "lg",
  className = "",
}: {
  id: string;
  eyebrow: React.ReactNode;
  title: string;
  link?: { href: string; label: string; short?: string };
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 sm:flex-wrap sm:gap-4 ${className}`}>
      <div className="flex flex-col gap-2.5 sm:gap-3.5">
        <span className="eyebrow text-plum-500">{eyebrow}</span>
        <h2
          id={id}
          className={`m-0 font-serif leading-[1.05] font-normal ${size === "lg" ? "text-[34px] sm:text-[clamp(38px,4vw,54px)]" : "text-[30px] sm:text-[clamp(34px,3.4vw,44px)]"}`}
        >
          {title}
        </h2>
      </div>
      {link && <ArrowLink href={link.href} label={link.label} short={link.short} />}
    </div>
  );
}

export function ArrowLink({ href, label, short, className = "" }: { href: string; label: string; short?: string; className?: string }) {
  return (
    <Link href={href} className={`eyebrow group inline-flex flex-none items-center gap-2.5 py-3 text-ink no-underline hover:text-plum-500 ${className}`}>
      {short ? (
        <>
          <span className="sm:hidden">{short} →</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
      <ArrowRight aria-hidden size={16} strokeWidth={1.5} className={`transition-transform group-hover:translate-x-1 ${short ? "hidden sm:block" : ""}`} />
    </Link>
  );
}
