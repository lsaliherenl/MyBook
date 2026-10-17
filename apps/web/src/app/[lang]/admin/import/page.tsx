import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import type { Locale } from "@/i18n/config";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/get-dictionary";
import { getCategories } from "@/lib/catalog";
import { languageName, localized } from "@/lib/format";
import { getStaff } from "@/lib/staff";
import { ImportWorkspace } from "./import-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.admin.import.title };
}

/** B16: add books from Google Books, Open Library and Apple Books — one at a time or a CSV of ISBNs. */
export default async function ImportPage({ searchParams }: PageProps<"/[lang]/admin/import">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<div aria-hidden className="m-10 h-96 animate-pulse bg-paper-2" />}>
      <Import t={t} locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Import({ t, locale, searchParams }: { t: Dictionary; locale: Locale; searchParams: PageProps<"/[lang]/admin/import">["searchParams"] }) {
  const [params, staff, categories] = await Promise.all([searchParams, getStaff(), getCategories()]);
  const i = t.admin.import;
  const q = typeof params.q === "string" ? params.q : "";
  return (
    <>
      <AdminTopBar staff={{ name: staff.fullName, role: t.admin.roles[staff.role] }} languageLabel={t.nav.language}>
        <AdminSearch action={`/${locale}/admin/desk`} label={t.admin.search} placeholder={t.admin.searchPlaceholder} />
      </AdminTopBar>
      <ImportWorkspace
        key={q}
        locale={locale}
        initialQuery={q}
        text={i}
        fields={t.admin.book}
        errors={t.admin.bookErrors}
        categories={categories.map((c) => ({ id: c.id, name: localized(c, "name", locale) }))}
        languages={["tr", "en", "de", "fr", "es", "it", "ru", "ar"].map((code) => ({ code, name: languageName(code, locale) }))}
      />
    </>
  );
}
