import type { Metadata } from "next";
import { ReadingStats } from "@/components/ReadingStats";

export const metadata: Metadata = { title: "إحصائياتي القرائية" };

export default function StatsPage() {
  return <ReadingStats />;
}
