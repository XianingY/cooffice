import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

beforeEach(() => localStorage.clear());

// Vitest runs without globals, so Testing Library cannot auto-register its
// cleanup hook. Unmount explicitly to keep DOM queries isolated per test.
afterEach(() => cleanup());
