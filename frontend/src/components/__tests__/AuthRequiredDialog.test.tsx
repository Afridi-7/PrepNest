import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";

describe("<AuthRequiredDialog />", () => {
  it("does not render dialog content when closed", () => {
    render(<AuthRequiredDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByText("Login Required")).not.toBeInTheDocument();
  });

  it("renders title, default message, and OK action when open", () => {
    render(<AuthRequiredDialog open={true} onOpenChange={() => {}} />);

    expect(screen.getByText("Login Required")).toBeInTheDocument();
    expect(
      screen.getByText("Please log in first to continue.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("shows the custom message prop when provided", () => {
    render(
      <AuthRequiredDialog
        open={true}
        onOpenChange={() => {}}
        message="Your session has expired."
      />
    );
    expect(screen.getByText("Your session has expired.")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the OK button is clicked", () => {
    const onOpenChange = vi.fn();
    render(<AuthRequiredDialog open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses an accessible alertdialog role with a labelled title", () => {
    render(<AuthRequiredDialog open={true} onOpenChange={() => {}} />);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    // The title text is associated with the dialog via aria-labelledby.
    expect(dialog).toHaveAccessibleName("Login Required");
  });
});
