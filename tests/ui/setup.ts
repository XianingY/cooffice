import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Node 25+ defines an experimental globalThis.localStorage stub that throws or
// lacks Storage methods unless --localstorage-file is passed. Prefer jsdom's
// Storage implementation whenever available so tests run cleanly on Node >=22.
if (typeof window !== "undefined" && window.localStorage && typeof globalThis.localStorage?.clear !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: window.localStorage,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  if (typeof globalThis.localStorage?.clear === "function") {
    globalThis.localStorage.clear();
  }
});

// Vitest runs without globals, so Testing Library cannot auto-register its
// cleanup hook. Unmount explicitly to keep DOM queries isolated per test.
afterEach(() => cleanup());
