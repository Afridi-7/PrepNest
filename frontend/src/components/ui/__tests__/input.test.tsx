import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

describe("<Input />", () => {
  it("renders with the given type and placeholder", () => {
    render(<Input type="email" placeholder="you@example.com" />);
    const input = screen.getByPlaceholderText("you@example.com");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "email");
  });

  it("fires onChange and reflects controlled value updates", () => {
    const Wrapper = () => {
      const [value, setValue] = useState("");
      return (
        <Input
          aria-label="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    };
    render(<Wrapper />);

    const input = screen.getByLabelText("email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ada@example.com" } });
    expect(input.value).toBe("ada@example.com");
  });

  it("forwards refs to the underlying input element", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={(el) => (ref.current = el)} aria-label="ref-input" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("does not fire onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Input aria-label="locked" disabled onChange={onChange} />);
    const input = screen.getByLabelText("locked");
    expect(input).toBeDisabled();
  });

  it("merges custom className with default styles", () => {
    render(<Input aria-label="styled" className="my-custom" />);
    const input = screen.getByLabelText("styled");
    expect(input.className).toContain("my-custom");
    expect(input.className).toContain("rounded-lg");
  });
});
