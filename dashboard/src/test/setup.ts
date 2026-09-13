import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// server-only is a no-op in tests
vi.mock("server-only", () => ({}));
