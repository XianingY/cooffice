import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Node 25+ defines an experimental globalThis.localStorage stub that lacks
// Storage methods unless --localstorage-file is passed, shadowing jsdom's
// Storage. Install an in-memory Storage implementation when missing so tests
// run identically on Node 22–26 without custom CLI flags.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

if (typeof globalThis.localStorage?.getItem !== "function") {
  const storage =
    typeof window !== "undefined" && typeof window.localStorage?.getItem === "function"
      ? window.localStorage
      : createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", { value: storage, configurable: true, writable: true });
  }
}

beforeEach(() => {
  if (typeof globalThis.localStorage?.clear === "function") {
    globalThis.localStorage.clear();
  }
});

// Vitest runs without globals, so Testing Library cannot auto-register its
// cleanup hook. Unmount explicitly to keep DOM queries isolated per test.
afterEach(() => cleanup());
