"use client";

import { Palette } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    const next = current === "light" ? "dark" : current === "dark" ? "arnooba" : "light";
    root.setAttribute("data-theme", next);
    const color = next === "dark" ? "#1b140e" : next === "arnooba" ? "#17172b" : "#f6efe3";
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", color);
    });
    try {
      localStorage.setItem("arnooba:theme", next);
    } catch {
      // private mode: the choice just won't persist
    }
  }

  return (
    <button type="button" onClick={toggle} className="btn-ghost h-10 w-10 p-0" aria-label="تغيير مظهر الموقع: فاتح أو ليلي أو أرنوبة" title="فاتح · ليلي · أرنوبة">
      <Palette className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
