import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContentProtection from "@/components/ContentProtection";

describe("<ContentProtection />", () => {
  it("renders its children inside a wrapper", () => {
    render(
      <ContentProtection>
        <p>secret notes</p>
      </ContentProtection>
    );
    expect(screen.getByText("secret notes")).toBeInTheDocument();
  });

  it("applies the content-protected class plus an extra className", () => {
    const { container } = render(
      <ContentProtection className="extra-class">
        <span>x</span>
      </ContentProtection>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("content-protected");
    expect(wrapper.className).toContain("extra-class");
  });

  it("blocks the contextmenu (right-click) event", () => {
    render(
      <ContentProtection>
        <span>x</span>
      </ContentProtection>
    );
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  it("blocks Ctrl+C copy shortcut", () => {
    render(
      <ContentProtection>
        <span>x</span>
      </ContentProtection>
    );
    const event = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  it("blocks F12 (devtools)", () => {
    render(
      <ContentProtection>
        <span>x</span>
      </ContentProtection>
    );
    const event = new KeyboardEvent("keydown", {
      key: "F12",
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  it("does NOT block ordinary keystrokes such as 'a' without modifiers", () => {
    render(
      <ContentProtection>
        <span>x</span>
      </ContentProtection>
    );
    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).not.toHaveBeenCalled();
  });

  it("blocks the global copy event", () => {
    render(
      <ContentProtection>
        <span>x</span>
      </ContentProtection>
    );
    const event = new Event("copy", { bubbles: true, cancelable: true });
    const prevent = vi.spyOn(event, "preventDefault");
    document.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  it("prevents drag from the wrapper element", () => {
    render(
      <ContentProtection>
        <span data-testid="child">x</span>
      </ContentProtection>
    );
    const wrapper = screen.getByTestId("child").parentElement!;
    const result = fireEvent.dragStart(wrapper);
    // fireEvent.* returns false when preventDefault was called
    expect(result).toBe(false);
  });
});
