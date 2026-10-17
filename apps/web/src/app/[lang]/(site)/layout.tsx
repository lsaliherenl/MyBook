import { Suspense, ViewTransition } from "react";
import { BagDrawer, BagProvider } from "@/components/bag/bag-drawer";
import { BAG_HEADING_ID, BagContents } from "@/components/bag/bag-contents";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Member-facing pages: header, footer and the borrow bag drawer. */
export default function SiteLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <BagProvider>
      <SiteHeader />
      <ViewTransition default="page">
        <main className="flex-1">{children}</main>
      </ViewTransition>
      <SiteFooter />
      <BagDrawer labelledBy={BAG_HEADING_ID}>
        <Suspense>
          <BagContents />
        </Suspense>
      </BagDrawer>
    </BagProvider>
  );
}
