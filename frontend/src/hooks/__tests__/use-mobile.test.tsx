import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

type Listener = () => void;

interface FakeMQL {
  matches: boolean;
  media: string;
  addEventListener: (type: "change", l: Listener) => void;
  removeEventListener: (type: "change", l: Listener) => void;
  dispatchChange: () => void;
  listeners: Set<Listener>;
}

function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

let mql: FakeMQL;

beforeEach(() => {
  const listeners = new Set<Listener>();
  mql = {
    matches: false,
    media: "",
    listeners,
    addEventListener: (_t, l) => {
      listeners.add(l);
    },
    removeEventListener: (_t, l) => {
      listeners.delete(l);
    },
    dispatchChange: () => listeners.forEach((l) => l()),
  };
  // jsdom doesn't implement matchMedia by default
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  it("returns true when viewport is below 768px", () => {
    setViewport(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is 768px or wider", () => {
    setViewport(1024);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when the media query change event fires after a resize", () => {
    setViewport(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setViewport(400);
      mql.dispatchChange();
    });

    expect(result.current).toBe(true);
  });

  it("removes its listener on unmount", () => {
    setViewport(800);
    const { unmount } = renderHook(() => useIsMobile());
    expect(mql.listeners.size).toBe(1);
    unmount();
    expect(mql.listeners.size).toBe(0);
  });
});
