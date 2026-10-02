"use client";

// Reading progress and the personal shelf live in localStorage: the site has
// no accounts, so nothing personal is ever sent to the server.
import { useMemo, useSyncExternalStore } from "react";

const CHANGE_EVENT = "arnooba:local-change";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readLocal<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return; // storage full or blocked: nothing else to do
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

function subscribe(key: string, onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === key && onChange();
  const onLocal = (e: Event) => (e as CustomEvent<string>).detail === key && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocal);
  };
}

/**
 * Subscribes to a JSON value in localStorage. `ready` is false during server
 * rendering and hydration, so markup never mismatches.
 */
export function useLocalJSON<T>(key: string, fallback: T): { value: T; ready: boolean } {
  const raw = useSyncExternalStore(
    (onChange) => subscribe(key, onChange),
    () => safeGet(key),
    () => undefined,
  );
  const value = useMemo(() => {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // `fallback` must be a module-level constant at call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  return { value, ready: raw !== undefined };
}
