import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("<Button />", () => {
  it("renders children and forwards click events", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire click when disabled (CSS pointer-events-none class applied)", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Disabled
      </Button>
    );

    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the requested variant + size classes", () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn.className).toContain("bg-destructive");
    expect(btn.className).toContain("h-12");
  });

  it("merges a custom className without dropping variant classes", () => {
    render(<Button className="my-extra">Hello</Button>);
    const btn = screen.getByRole("button", { name: "Hello" });
    expect(btn.className).toContain("my-extra");
    expect(btn.className).toContain("bg-primary");
  });

  it("renders as a child element when asChild is set (Slot pattern)", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Go</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("href", "/dashboard");
    // The button's classes should be forwarded onto the <a> child.
    expect(link.className).toContain("inline-flex");
  });

  it("respects accessibility attributes (aria-label, type)", () => {
    render(
      <Button type="submit" aria-label="Submit form">
        Go
      </Button>
    );
    const btn = screen.getByRole("button", { name: "Submit form" });
    expect(btn).toHaveAttribute("type", "submit");
  });
});
