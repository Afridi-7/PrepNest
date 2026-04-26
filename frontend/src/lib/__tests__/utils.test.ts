import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className merger)", () => {
  it("merges multiple class strings", () => {
    expect(cn("p-2", "text-sm")).toBe("p-2 text-sm");
  });

  it("filters out falsy values", () => {
    expect(cn("p-2", false, null, undefined, "", "text-sm")).toBe("p-2 text-sm");
  });

  it("supports conditional object syntax", () => {
    expect(cn("p-2", { hidden: false, block: true })).toBe("p-2 block");
  });

  it("dedupes conflicting tailwind classes (twMerge)", () => {
    // p-2 should be overridden by p-4
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm text-base")).toBe("text-base");
  });

  it("returns an empty string when given no inputs", () => {
    expect(cn()).toBe("");
  });

  it("flattens arrays of class values", () => {
    expect(cn(["p-2", ["text-sm", { rounded: true }]])).toContain("p-2");
    expect(cn(["p-2", ["text-sm", { rounded: true }]])).toContain("text-sm");
    expect(cn(["p-2", ["text-sm", { rounded: true }]])).toContain("rounded");
  });
});
