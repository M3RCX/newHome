import { useEffect, useRef, useState } from "react";
import { chapters } from "../content";
import { paragraphs } from "../lib/format";
import Gallery from "./Gallery";

const KEY_FLOOR = chapters.findIndex((c) => c.key);

// Prédio lateral: as janelas de cada andar acendem quando o capítulo entra na tela.
function Building({ lit }: { lit: Set<number> }) {
  const N = chapters.length;
  const fh = 34;
  const w = 150;
  const top = 40;
  const H = top + N * fh + 20;
  const craneGone = KEY_FLOOR >= 0 && lit.has(KEY_FLOOR);

  return (
    <svg viewBox={`0 0 200 ${H}`} role="img">
      <g fill="none" stroke="var(--ink)" strokeWidth="2.5">
        <g
          className="crane"
          stroke="var(--muted)"
          strokeWidth="2"
          style={{ opacity: craneGone ? 0 : 1, transition: "opacity .6s" }}
        >
          <path d={`M150 ${top} V6 M110 10 H190 M150 6 L120 10 M150 6 L185 10 M180 10 V26`} />
        </g>
        <rect x="25" y={top} width={w} height={N * fh} fill="var(--card)" />
        {chapters.map((_, i) => {
          const y = top + (N - 1 - i) * fh;
          const fill = lit.has(i) ? "var(--lit)" : "var(--paper)";
          return (
            <g key={i}>
              <line x1="25" x2="175" y1={y} y2={y} strokeWidth="1.2" stroke="var(--line)" />
              {[0, 1, 2].map((k) => {
                const x = 40 + k * 44;
                const style = { transition: "fill .5s" };
                // Térreo: porta no lugar da janela do meio.
                return i === 0 && k === 1 ? (
                  <rect key={k} x={x + 6} y={y + 8} width="22" height={fh - 8} fill={fill} strokeWidth="1.5" style={style} />
                ) : (
                  <rect key={k} x={x} y={y + 9} width="34" height="16" rx="1.5" fill={fill} strokeWidth="1.5" style={style} />
                );
              })}
            </g>
          );
        })}
        <line x1="5" x2="195" y1={top + N * fh} y2={top + N * fh} strokeWidth="3" />
      </g>
    </svg>
  );
}

export default function Story() {
  const N = chapters.length;
  const [lit, setLit] = useState<Set<number>>(() => new Set());
  const floorRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const light = (i: number) => setLit((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    if (!("IntersectionObserver" in window)) {
      chapters.forEach((_, i) => light(i));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          light(Number((e.target as HTMLElement).dataset.floor));
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -35% 0px" },
    );
    floorRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="story" id="historia" aria-labelledby="h-story">
      <div className="story-head">
        <span className="eyebrow">
          <span className="spark" />
          &nbsp; Como chegamos até aqui
        </span>
        <h2 id="h-story">A nossa história</h2>
        <span className="hand">do stand até o 7º andar, sobe com a gente</span>
      </div>
      <div className="building" aria-hidden="true">
        <Building lit={lit} />
        <div className="cap">{N} andares · o nosso é o último</div>
      </div>
      <div className="floors">
        {chapters.map((ch, i) => (
          <article
            key={ch.title}
            ref={(el) => {
              floorRefs.current[i] = el;
            }}
            className={`floor${ch.key ? " key" : ""}${lit.has(i) ? " lit" : ""}`}
            data-floor={i}
          >
            <span className="andar">
              {i + 1}º andar{i === N - 1 ? " · é aqui" : ""}
              {ch.minor && <span className="date-small">{ch.date}</span>}
            </span>
            {!ch.minor && <span className="date-big">{ch.date}</span>}
            <h3>{ch.title}</h3>
            {ch.gallery === "obra" && (
              <div className="wait">
                <span>
                  <b>3</b>anos
                </span>
                <span>
                  <b>5</b>meses
                </span>
                <span>
                  <b>30</b>dias
                </span>
              </div>
            )}
            {paragraphs(ch.text).map((p, j) => (
              <p key={j} className={i === 0 && j === 0 ? "first-p" : undefined}>
                {p.split("\n").map((line, k, all) => (
                  <span key={k}>
                    {line}
                    {k < all.length - 1 && <br />}
                  </span>
                ))}
              </p>
            ))}
            {ch.gallery && <Gallery name={ch.gallery} />}
          </article>
        ))}
      </div>
    </section>
  );
}
