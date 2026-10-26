import { chapters } from "../content";

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

type Props = { freeItems: number | null; vales: number | null };

// Sumário em forma de quadro de andares do prédio.
export default function Directory({ freeItems, vales }: Props) {
  const N = chapters.length;
  const rows = [
    ["historia", `1º ao ${N}º andar`, "A nossa história", `${N} capítulos curtinhos, do stand até o 7º andar`],
    [
      "presentes",
      "Planta do apê",
      "Lista de presentes",
      freeItems == null ? "pra levar ou mandar Pix" : `${freeItems} presentes disponíveis, pra levar ou mandar Pix`,
    ],
    ["vales", "Cobertura", "Vales pra vida nova", vales == null ? "momentos pra presentear por Pix" : `${vales} momentos pra presentear por Pix`],
  ];

  return (
    <nav className="directory" aria-label="Sumário">
      <div className="d-head">
        <span>Sumário · quadro de andares</span>
        <span>toque pra subir</span>
      </div>
      <ol>
        {rows.map(([id, floor, name, desc]) => (
          <li key={id}>
            <button type="button" onClick={() => scrollToSection(id)}>
              <span className="fl">{floor}</span>
              <span className="nm">{name}</span>
              <span className="ds">{desc}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
