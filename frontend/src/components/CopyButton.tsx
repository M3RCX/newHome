import { useState } from "react";

// Copia o texto; se a área de transferência não estiver disponível, seleciona o alvo para cópia manual.
export default function CopyButton({ text, targetId, label }: { text: string; targetId: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      const el = document.getElementById(targetId);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setState("selected");
    }
  }

  return (
    <button type="button" className="btn ghost" onClick={copy}>
      {state === "copied" ? "Copiado!" : state === "selected" ? "Selecionado, copie" : label}
    </button>
  );
}
