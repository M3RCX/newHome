import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminProducts } from "../../hooks/useAdmin";
import { brl } from "../../lib/format";
import { describeContribution, LoadError, Loading } from "./shared";

type KindFilter = "todos" | "item" | "cota";
type StatusFilter = "todos" | "livre" | "escolhido" | "com-contribuicao";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function ProductList() {
  const { data: products, isPending, isError, refetch } = useAdminProducts();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("todos");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [room, setRoom] = useState("todos");

  const rooms = useMemo(() => [...new Set(products?.map((p) => p.room) ?? [])].sort(), [products]);

  const shown = useMemo(() => {
    const term = normalize(q.trim());
    return (products ?? []).filter(
      (p) =>
        (kind === "todos" || p.kind === kind) &&
        (room === "todos" || p.room === room) &&
        (status === "todos" ||
          (status === "com-contribuicao" ? p.contributions.length > 0 : p.kind === "item" && p.status === status)) &&
        (!term ||
          normalize(`${p.name} ${p.slug} ${p.spec} ${p.contributions.map((c) => c.guestName).join(" ")}`).includes(term)),
    );
  }, [products, q, kind, status, room]);

  return (
    <>
      <h1>Presentes</h1>
      <p className="sub">Clique num presente para editar, ver quem escolheu ou lançar uma contribuição.</p>

      <div className="toolbar">
        <div className="field grow">
          <label htmlFor="q">Buscar</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="nome, chave ou convidado" />
        </div>
        <div className="field">
          <label htmlFor="kind">Tipo</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
            <option value="todos">Todos</option>
            <option value="item">Presentes</option>
            <option value="cota">Vales</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="status">Situação</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="todos">Todas</option>
            <option value="livre">Disponíveis</option>
            <option value="escolhido">Escolhidos</option>
            <option value="com-contribuicao">Com contribuição</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="room">Cômodo</label>
          <select id="room" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="todos">Todos</option>
            {rooms.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <Link className="btn main" to="/admin/presentes/novo">
          + Novo presente
        </Link>
      </div>

      {isPending ? (
        <Loading what="os presentes" />
      ) : isError ? (
        <LoadError onRetry={refetch} />
      ) : (
        <>
          <div className="count">
            {shown.length} de {products.length} presentes
          </div>
          <div className="plist">
            {shown.map((p) => (
              <Link key={p.id} to={`/admin/presentes/${p.id}`} className="prow">
                <div className="pthumb">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : "sem foto"}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="pname">{p.name}</div>
                  <div className="pmeta">
                    <span>{p.room}</span>
                    <span>{p.slug}</span>
                    {p.contributions.length > 1 && <span>{p.contributions.length} contribuições</span>}
                  </div>
                  {p.contributions.slice(0, 3).map((c) => (
                    <div className="pwho" key={c.id}>
                      {describeContribution(c)}
                    </div>
                  ))}
                  {p.contributions.length > 3 && <div className="pwho">+ {p.contributions.length - 3}</div>}
                </div>
                <div className="pright">
                  <span className="pprice">{p.priceCents > 0 ? brl(p.priceCents) : "livre"}</span>
                  <span className={`pill ${p.kind === "cota" ? "cota" : p.status}`}>
                    {p.kind === "cota" ? "vale" : p.status === "escolhido" ? "escolhido" : "disponível"}
                  </span>
                </div>
              </Link>
            ))}
            {!shown.length && <div className="empty">nenhum presente com esses filtros</div>}
          </div>
        </>
      )}
    </>
  );
}
