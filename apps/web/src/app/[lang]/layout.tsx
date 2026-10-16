import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { lang } from "next/root-params";
import { SiteHeader } from "@/components/site-header";
import { LOCALES } from "@/i18n/config";
import "../globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "MyBook", template: "%s · MyBook" },
  description: "University library — reserve online, pick up at the desk.",
};

export async function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l }));
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <html lang={await lang()} className={`${cormorant.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
