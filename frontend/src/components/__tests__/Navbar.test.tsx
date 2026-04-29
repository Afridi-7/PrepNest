import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";

// Mocks must be declared before importing Navbar.
const isAuthenticated = vi.fn<[], boolean>();
const checkIsAdmin = vi.fn<[], Promise<boolean>>();
const clearToken = vi.fn();

vi.mock("@/services/api", () => ({
  apiClient: {
    isAuthenticated: () => isAuthenticated(),
    checkIsAdmin: () => checkIsAdmin(),
    clearToken: () => clearToken(),
  },
}));

// framer-motion's AnimatePresence + motion components animate via rAF;
// in jsdom we just want them to render their children synchronously.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const passthrough = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement(tag, { ref, ...props }, children)
    );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(
      {},
      { get: (_t, key: string) => passthrough(key as keyof JSX.IntrinsicElements) }
    ),
  };
});

import Navbar from "@/components/Navbar";

const renderNavbar = (initialPath = "/") =>
  render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <MemoryRouter initialEntries={[initialPath]}>
        <Navbar />
      </MemoryRouter>
    </ThemeProvider>
  );

describe("<Navbar />", () => {
  beforeEach(() => {
    isAuthenticated.mockReset();
    checkIsAdmin.mockReset();
    clearToken.mockReset();
    checkIsAdmin.mockResolvedValue(false);
  });

  it("shows Log In and Start free trial CTAs when the visitor is anonymous", () => {
    isAuthenticated.mockReturnValue(false);
    renderNavbar();

    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start free trial/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /logout/i })).not.toBeInTheDocument();
  });

  it("hides auth-gated nav links for anonymous visitors", () => {
    isAuthenticated.mockReturnValue(false);
    renderNavbar();

    // "Home" and "About Us" are public.
    expect(screen.getAllByRole("button", { name: /home/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /about us/i }).length).toBeGreaterThan(0);
    // "Dashboard" is gated.
    expect(screen.queryByRole("button", { name: /^dashboard$/i })).not.toBeInTheDocument();
  });

  it("reveals authenticated links and the Logout button when signed in", async () => {
    isAuthenticated.mockReturnValue(true);
    renderNavbar();

    expect(screen.getAllByRole("button", { name: /^dashboard$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /log in/i })).not.toBeInTheDocument();
  });

  it("calls apiClient.clearToken when Logout is clicked", () => {
    isAuthenticated.mockReturnValue(true);
    renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(clearToken).toHaveBeenCalledTimes(1);
  });

  it("renders an Admin entry once checkIsAdmin resolves true", async () => {
    isAuthenticated.mockReturnValue(true);
    checkIsAdmin.mockResolvedValue(true);
    renderNavbar();

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /admin/i }).length).toBeGreaterThan(0)
    );
  });

  it("exposes an accessible label on the theme toggle button", () => {
    isAuthenticated.mockReturnValue(false);
    renderNavbar();

    // Both desktop and mobile toggles share the same aria-label.
    const toggles = screen.getAllByRole("button", { name: /switch to (light|dark) theme/i });
    expect(toggles.length).toBeGreaterThan(0);
  });

  it("opens the mobile menu when the hamburger button is clicked", () => {
    isAuthenticated.mockReturnValue(false);
    renderNavbar();

    // The mobile menu shows duplicate nav buttons; before opening there is
    // exactly one "Home" button (desktop). After opening, there are two.
    const initialHomeCount = screen.getAllByRole("button", { name: /home/i }).length;

    // The menu toggle is the only unlabelled icon button after the theme toggle.
    const allButtons = screen.getAllByRole("button");
    const menuButton = allButtons.find(
      (b) => !b.getAttribute("aria-label") && b.textContent === ""
    );
    expect(menuButton).toBeTruthy();
    fireEvent.click(menuButton!);

    expect(
      screen.getAllByRole("button", { name: /home/i }).length
    ).toBeGreaterThan(initialHomeCount);
  });
});
