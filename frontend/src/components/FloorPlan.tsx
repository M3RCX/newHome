import { BANDS, PLAN, ROOMS, type PlanZone } from "../content";
import type { Product } from "../lib/types";

export type Filters = { room: string; band: string; onlyFree: boolean };
export const ALL_ROOMS = "Todos";

type Props = {
  items: Product[];
  filters: Filters;
  onChange: (next: Filters) => void;
};

// Planta do apê: cada cômodo é um filtro da lista de presentes.
export default function FloorPlan({ items, filters, onChange }: Props) {
  const free = (room: string) => items.filter((g) => g.room === room && g.status === "livre").length;
  const total = (room: string) => items.filter((g) => g.room === room).length;
  const label = (room: string) => {
    const f = free(room);
    const t = total(room);
    if (!t) return "nada por aqui ainda";
    return f ? `${f} ${f === 1 ? "presente" : "presentes"}` : "tudo escolhido";
  };
  const toggleRoom = (room: string) =>
    onChange({ ...filters, room: filters.room === room && room !== ALL_ROOMS ? ALL_ROOMS : room });

  // Cômodos/categorias com presentes que não estão desenhados na planta.
  const known = new Set(ROOMS);
  const extraRooms = [
    ...ROOMS.filter((r) => !PLAN.some((p) => p.room === r) && total(r)),
    ...[...new Set(items.map((g) => g.room))].filter((r) => !known.has(r)),
  ];

  const zone = (p: PlanZone) => {
    const on = filters.room === p.room;
    const done = total(p.room) > 0 && free(p.room) === 0;
    return (
      <g
        key={p.room}
        className={`rz${done ? " done" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label={`${p.room}: ${label(p.room)}`}
        onClick={() => toggleRoom(p.room)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleRoom(p.room);
          }
        }}
      >
        <polygon className="hit" points={p.pts} />
        <text x={p.tx} y={p.ty} className="t-name">
          {p.room.toUpperCase()}
        </text>
        <text
          x={p.tx}
          y={p.ty + (p.small ? 0 : 32)}
          className="t-count"
          dx={p.small ? p.room.length * 14 + 12 : undefined}
        >
          {label(p.room)}
        </text>
        {!p.small && !p.nonote && (
          <text x={p.tx} y={p.ty + 60} className="t-note">
            {p.note}
          </text>
        )}
        <text x={p.dx} y={p.dy} className="t-dim">
          {p.dim}
        </text>
      </g>
    );
  };

  return (
    <div className="plan-wrap">
      <div className="plan">
        <svg viewBox="-10 -10 1060 800" role="group" aria-label="Planta do apê: escolha um cômodo">
          <polygon
            className="floor-bg"
            points="0,115 678,115 678,3 1038,3 1038,455 915,455 915,735 580,735 580,775 233,775 233,683 0,683"
          />
          <g className="furn">
            <rect x="35" y="150" width="70" height="90" rx="6" />
            <rect x="35" y="250" width="70" height="140" />
            <rect x="62" y="300" width="28" height="30" rx="4" />
            <rect x="35" y="400" width="70" height="70" />
            <circle cx="55" cy="420" r="9" />
            <circle cx="85" cy="420" r="9" />
            <circle cx="55" cy="450" r="9" />
            <circle cx="85" cy="450" r="9" />
            <rect x="260" y="230" width="145" height="90" />
            <rect x="275" y="195" width="45" height="35" rx="6" />
            <rect x="345" y="195" width="45" height="35" rx="6" />
            <rect x="275" y="320" width="45" height="35" rx="6" />
            <rect x="345" y="320" width="45" height="35" rx="6" />
            <rect x="470" y="435" width="85" height="215" rx="8" />
            <rect x="255" y="480" width="45" height="175" />
            <rect x="540" y="160" width="55" height="70" rx="20" />
            <ellipse cx="660" cy="180" rx="30" ry="25" />
            <rect x="430" y="150" width="100" height="140" />
            <rect x="35" y="490" width="65" height="70" rx="6" />
            <circle cx="72" cy="610" r="30" />
            <rect x="725" y="70" width="230" height="185" rx="6" />
            <rect x="725" y="80" width="60" height="70" rx="8" />
            <rect x="725" y="160" width="60" height="70" rx="8" />
            <rect x="825" y="360" width="185" height="62" />
            <rect x="695" y="450" width="190" height="62" />
            <rect x="635" y="605" width="245" height="105" rx="6" />
            <circle cx="510" cy="715" r="24" />
          </g>
          {PLAN.map(zone)}
          <g className="walls">
            <polygon points="0,115 678,115 678,3 1038,3 1038,455 915,455 915,735 580,735 580,775 233,775 233,683 0,683" />
            <path d="M28 480 H235 M235 480 V660 M420 140 V300 M420 300 H560 M600 300 H690 M705 30 V290 M705 330 V428 M705 428 H1015 M580 440 H660 M700 440 H885 M580 470 V712" />
            <path className="glass" d="M235 660 H565 M140 683 H210 M660 735 H800 M1038 160 V285 M140 115 H250" />
          </g>
        </svg>
      </div>
      <div className="extra-rooms">
        {[...PLAN.map((p) => p.room), ...extraRooms].map((room) => (
          <button
            type="button"
            key={room}
            className="chip"
            aria-pressed={filters.room === room}
            onClick={() => toggleRoom(room)}
          >
            {room} · {free(room)}
          </button>
        ))}
      </div>
      <div className="bands" role="group" aria-label="Faixa de valor">
        {BANDS.map((b) => (
          <button
            type="button"
            key={b.id}
            className="band"
            aria-pressed={filters.band === b.id}
            onClick={() => onChange({ ...filters, band: b.id })}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div className="plan-foot">
        <span>
          {filters.room === ALL_ROOMS ? (
            "Mostrando a casa inteira"
          ) : (
            <>
              Mostrando: {filters.room} ·{" "}
              <button type="button" onClick={() => onChange({ ...filters, room: ALL_ROOMS })}>
                ver a casa inteira
              </button>
            </>
          )}
        </span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={filters.onlyFree}
            onChange={(e) => onChange({ ...filters, onlyFree: e.target.checked })}
          />{" "}
          só os disponíveis
        </label>
      </div>
    </div>
  );
}
