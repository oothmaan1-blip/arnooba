import type { Metadata } from "next";
import { BookListPage, listTitle } from "@/components/BookListPage";

export async function generateMetadata({ searchParams }: PageProps<"/ar">): Promise<Metadata> {
  return {
    title: listTitle("ar", await searchParams),
    description: "كتب عربية مجانية للقراءة أونلاين والتحميل: روايات وأدب وتاريخ وفلسفة من كتب التراث وما بعده.",
    alternates: { canonical: "/ar" },
  };
}

export default async function ArabicBooksPage({ searchParams }: PageProps<"/ar">) {
  return <BookListPage lang="ar" searchParams={await searchParams} />;
}
