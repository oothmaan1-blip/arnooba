"use client";

import { useEffect, useState } from "react";
import { Plus, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Guide = "ios" | "android" | "installed";

function homeScreenGuide(): Guide {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || window.matchMedia("(display-mode: standalone)").matches) return "installed";
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
    ? "ios"
    : "android";
}

export function InstallAppButton() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!guide) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuide(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [guide]);

  async function addToHomeScreen() {
    if (installed) {
      setGuide("installed");
      return;
    }
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        setInstallEvent(null);
        if (choice.outcome === "accepted") setInstalled(true);
      } catch {
        setGuide(homeScreenGuide());
      }
      return;
    }
    setGuide(homeScreenGuide());
  }

  return (
    <>
      <button type="button" onClick={addToHomeScreen} className="btn-secondary w-full justify-start">
        {installEvent ? <Plus className="h-4 w-4" aria-hidden="true" /> : <Smartphone className="h-4 w-4" aria-hidden="true" />}
        {installed ? "أرنوبة مضافة للهاتف" : "أضف أرنوبة للهاتف"}
      </button>
      {guide && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGuide(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-app-title"
            className="card w-full max-w-sm p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="install-app-title" className="text-lg font-bold">إضافة أرنوبة للهاتف</h2>
              <button type="button" className="btn-ghost h-9 w-9 p-0" aria-label="إغلاق" onClick={() => setGuide(null)}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">
              {guide === "installed"
                ? "أرنوبة مضافة بالفعل إلى الشاشة الرئيسية على هذا الجهاز."
                : guide === "ios"
                  ? "افتح الموقع في Safari، اضغط زر المشاركة، اختر «إضافة إلى الشاشة الرئيسية»، ثم اضغط «إضافة». إذا ظهر خيار «فتح كتطبيق ويب»، فعّله."
                  : "من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، ثم أكّد الإضافة."}
            </p>
            <button type="button" className="btn-primary mt-4 w-full" onClick={() => setGuide(null)}>تمام</button>
          </section>
        </div>
      )}
    </>
  );
}
