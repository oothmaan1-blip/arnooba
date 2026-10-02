import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { NotFoundContent } from "@/components/NotFoundContent";

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <NotFoundContent />
      </main>
      <Footer />
    </div>
  );
}
