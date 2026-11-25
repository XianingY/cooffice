import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface DialogProps {
  labelledBy: string;
  describedBy?: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * Shared modal shell: focus moves in on mount, Tab cannot escape, Escape
 * closes, and focus returns to the trigger afterwards. Every dialog in the app
 * uses it so the keyboard contract cannot drift between them.
 */
export function Dialog({ labelledBy, describedBy, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const autofocus = node?.querySelector<HTMLElement>("[data-autofocus]");
    (autofocus ?? node)?.focus();
    return () => previous?.focus?.();
  }, []);

  const focusables = (): HTMLElement[] =>
    ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

  return (
    <div className="dialog-backdrop">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className="dialog"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;
          const items = focusables();
          if (items.length === 0) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
