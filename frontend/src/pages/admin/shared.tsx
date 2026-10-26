import type { Contribution } from "../../lib/adminApi";
import { brl } from "../../lib/format";
import type { ContributionMode } from "../../lib/types";

export const MODE_LABEL: Record<ContributionMode, string> = {
  levar: "vai levar",
  pix: "Pix",
  parte: "parte via Pix",
};

export const describeContribution = (c: Contribution) =>
  `${c.guestName} · ${MODE_LABEL[c.mode]}${c.mode === "levar" ? "" : ` ${brl(c.amountCents)}`}`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Loading({ what }: { what: string }) {
  return (
    <div className="loading" role="status">
      carregando {what}…
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="alert" role="alert">
      Não deu pra carregar.{" "}
      <button type="button" className="linkbtn" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}
