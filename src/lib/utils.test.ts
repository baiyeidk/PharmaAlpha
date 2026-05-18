import { describe, expect, it } from "vitest";
import { cn, createId } from "./utils";

describe("cn", () => {
  it("merges plain class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting tailwind classes (later wins)", () => {
    // tailwind-merge should keep the last padding utility only
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("supports clsx-style conditional objects", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });
});

describe("createId", () => {
  it("returns a non-empty string", () => {
    const id = createId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values across calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
  });

  it("uses crypto.randomUUID when available (UUID v4 shape)", () => {
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidLike.test(createId())).toBe(true);
  });

  it("falls back with prefix when crypto.randomUUID is missing", async () => {
    const original = globalThis.crypto;
    // Force fallback: pretend crypto is gone
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    try {
      const id = createId("evt");
      expect(id.startsWith("evt-")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: original,
        configurable: true,
      });
    }
  });
});
