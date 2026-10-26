import { useEffect, useRef, type ReactNode } from "react";

type Props = { label: string; onClose: () => void; children: ReactNode };

// Modal do design (.scrim/.modal): fecha no Esc, no "fechar" e clicando fora; trava o scroll da página.
export default function Modal({ label, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Só na abertura: foco inicial, Esc e trava de scroll (onClose via ref para não refazer a cada render).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add("modal-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const first = dialogRef.current?.querySelector<HTMLElement>("input, textarea, select");
    (first ?? dialogRef.current)?.focus();
    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} ref={dialogRef} tabIndex={-1}>
        <button type="button" className="x" onClick={onClose}>
          fechar ✕
        </button>
        {children}
      </div>
    </div>
  );
}
