import { describe, it, expect } from "vitest";
import { reducer } from "@/hooks/use-toast";

type ToastShape = {
  id: string;
  title?: string;
  description?: string;
  open?: boolean;
};

const makeToast = (id: string, extras: Partial<ToastShape> = {}): ToastShape => ({
  id,
  title: `t-${id}`,
  open: true,
  ...extras,
});

describe("toast reducer", () => {
  it("ADD_TOAST prepends a new toast and respects TOAST_LIMIT=1", () => {
    const state = { toasts: [makeToast("1")] };
    const next = reducer(state as never, {
      type: "ADD_TOAST",
      toast: makeToast("2") as never,
    });
    expect(next.toasts).toHaveLength(1);
    expect(next.toasts[0].id).toBe("2");
  });

  it("UPDATE_TOAST patches an existing toast by id without touching others", () => {
    const state = { toasts: [makeToast("1", { title: "old" })] };
    const next = reducer(state as never, {
      type: "UPDATE_TOAST",
      toast: { id: "1", title: "new" } as never,
    });
    expect(next.toasts[0].title).toBe("new");
  });

  it("DISMISS_TOAST closes the targeted toast (open=false)", () => {
    const state = {
      toasts: [makeToast("1", { open: true })],
    };
    const next = reducer(state as never, {
      type: "DISMISS_TOAST",
      toastId: "1",
    });
    expect(next.toasts[0].open).toBe(false);
  });

  it("DISMISS_TOAST without an id closes all toasts", () => {
    const state = {
      toasts: [
        makeToast("1", { open: true }),
        makeToast("2", { open: true }),
      ],
    };
    const next = reducer(state as never, { type: "DISMISS_TOAST" });
    expect(next.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("REMOVE_TOAST with id deletes that toast only", () => {
    const state = {
      toasts: [makeToast("1"), makeToast("2")],
    };
    const next = reducer(state as never, {
      type: "REMOVE_TOAST",
      toastId: "1",
    });
    expect(next.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("REMOVE_TOAST without id clears all", () => {
    const state = {
      toasts: [makeToast("1"), makeToast("2")],
    };
    const next = reducer(state as never, { type: "REMOVE_TOAST" });
    expect(next.toasts).toEqual([]);
  });
});
