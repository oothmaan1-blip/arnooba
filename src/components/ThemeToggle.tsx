"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("arnooba:theme", next);
    } catch {
      // private mode: the choice just won't persist
    }
  }

  return (
    <button type="button" onClick={toggle} className="btn-ghost h-10 w-10 p-0" aria-label="تبديل الوضع الليلي">
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
