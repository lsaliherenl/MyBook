import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { lang } from "next/root-params";
import { FloatingScrollbar } from "@/components/floating-scrollbar";
import { ServiceWorker } from "@/components/service-worker";
import { LOCALES } from "@/i18n/config";
import "../globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "MY / BOOK", template: "%s · MY / BOOK" },
  description: "University library — reserve online, pick up at the desk.",
};

export async function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l }));
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <html lang={await lang()} className={`${cormorant.variable} ${jost.variable}`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <FloatingScrollbar />
        <ServiceWorker />
      </body>
    </html>
  );
}
