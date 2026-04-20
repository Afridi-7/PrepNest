import { useEffect, useCallback, useRef, type ReactNode } from "react";

/**
 * Wraps children with anti-screenshot / anti-copy protections.
 * – Blocks right-click context menu
 * – Blocks Ctrl+C / Ctrl+A / Ctrl+S / Ctrl+P / Ctrl+Shift+I / PrintScreen
 * – Disables text selection via CSS
 * – Hides content on print (@media print handled in index.css)
 * – Blurs content when the window loses visibility (tab switch for screen-record tools)
 * – Prevents drag-and-drop of content
 */

interface Props {
  children: ReactNode;
  /** Optional extra className on the wrapper */
  className?: string;
}

const BLOCKED_KEYS = new Set([
  "PrintScreen",
  "F12",
]);

const BLOCKED_CTRL = new Set(["c", "a", "s", "p", "u"]);
const BLOCKED_CTRL_SHIFT = new Set(["i", "j", "c", "s"]);

export default function ContentProtection({ children, className = "" }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef(false);

  /* ── Keyboard shortcut blocker ── */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (BLOCKED_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && BLOCKED_CTRL_SHIFT.has(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && BLOCKED_CTRL.has(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }, []);

  /* ── Right-click blocker ── */
  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /* ── Visibility change – blur content when tab hidden ── */
  const handleVisibility = useCallback(() => {
    if (!wrapperRef.current) return;
    if (document.hidden) {
      wrapperRef.current.style.filter = "blur(20px)";
      blurRef.current = true;
    } else {
      wrapperRef.current.style.filter = "";
      blurRef.current = false;
    }
  }, []);

  /* ── Prevent drag ── */
  const handleDrag = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  /* ── Copy / cut blocker ── */
  const handleCopy = useCallback((e: Event) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("dragstart", handleDrag, true);
    document.addEventListener("copy", handleCopy, true);
    document.addEventListener("cut", handleCopy, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("dragstart", handleDrag, true);
      document.removeEventListener("copy", handleCopy, true);
      document.removeEventListener("cut", handleCopy, true);
      // Clean up blur if unmounting while hidden
      if (wrapperRef.current) {
        wrapperRef.current.style.filter = "";
      }
    };
  }, [handleKeyDown, handleContextMenu, handleVisibility, handleDrag, handleCopy]);

  return (
    <div
      ref={wrapperRef}
      className={`content-protected ${className}`}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
