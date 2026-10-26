import { PARTE_MIN_CENTS } from "../content";
import { brl } from "../lib/format";
import type { Product } from "../lib/types";

// Rótulo da loja a partir do link (o design sempre mostrava "Mercado Livre").
export function storeName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("mercadolivre") || host.includes("mercadolibre")) return "Mercado Livre";
    if (host.includes("amazon")) return "Amazon";
    if (host.includes("magazineluiza") || host.includes("magalu")) return "Magalu";
    if (host.includes("shopee")) return "Shopee";
    return host;
  } catch {
    return "a loja";
  }
}

type Props = { gift: Product; onPick: (gift: Product) => void };

export default function GiftCard({ gift, onPick }: Props) {
  const taken = gift.status !== "livre";
  const store = gift.purchaseUrl ? storeName(gift.purchaseUrl) : null;

  return (
    <article className={`tag${taken ? " taken" : ""}`}>
      {taken && <span className="stamp">Escolhido</span>}
      {gift.imageUrl && (
        <div className="thumb">
          <img src={gift.imageUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="meta">
        <span>{gift.room}</span>
        <span>{store ?? "levar ou Pix"}</span>
      </div>
      <h3>{gift.name}</h3>
      <p className="spec">{gift.spec}</p>
      <div className="price">
        {gift.priceCents > 0 ? brl(gift.priceCents) : "—"}
        {!gift.purchaseUrl && <small>REF.</small>}
      </div>
      {!taken && gift.priceCents >= PARTE_MIN_CENTS && <span className="part">aceita Pix de qualquer valor</span>}
      <div className="acts">
        {!taken && (
          <button type="button" className="btn main" onClick={() => onPick(gift)}>
            Quero dar este
          </button>
        )}
        {gift.purchaseUrl && (
          <a className="buy" href={gift.purchaseUrl} target="_blank" rel="noopener noreferrer">
            Ver em {store} ↗
          </a>
        )}
      </div>
    </article>
  );
}
