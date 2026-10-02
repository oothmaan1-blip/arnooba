import type { Metadata } from "next";
import { BookListPage, listTitle } from "@/components/BookListPage";

export async function generateMetadata({ searchParams }: PageProps<"/en">): Promise<Metadata> {
  return {
    title: listTitle("en", await searchParams),
    description: "كتب إنكليزية مجانية للقراءة والتحميل: روايات عالمية وأدب وتاريخ وفلسفة من كلاسيكيات الملكية العامة.",
    alternates: { canonical: "/en" },
  };
}

export default async function EnglishBooksPage({ searchParams }: PageProps<"/en">) {
  return <BookListPage lang="en" searchParams={await searchParams} />;
}
