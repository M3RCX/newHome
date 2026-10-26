import { brl0 } from "../lib/format";
import type { Product } from "../lib/types";

type Props = { vale: Product; number: number; onPick: (vale: Product) => void };

// Vale destacável: sempre disponível (repetível), só por Pix.
export default function ValeCard({ vale, number, onPick }: Props) {
  return (
    <article className={`vale${/lasanha/i.test(vale.name) ? " paw" : ""}`}>
      <div className="v-main">
        <span className="eyebrow">Vale {String(number).padStart(2, "0")}</span>
        <h3>{vale.name}</h3>
        <p>{vale.spec}</p>
      </div>
      <div className="stub">
        <small>valor</small>
        <span className="v">{vale.priceCents > 0 ? brl0(vale.priceCents) : "livre"}</span>
        <button type="button" onClick={() => onPick(vale)}>
          Presentear
        </button>
      </div>
    </article>
  );
}
