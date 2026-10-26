import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAdminProducts, useSummary } from "../../hooks/useAdmin";
import { brl } from "../../lib/format";
import { formatDateTime, LoadError, Loading, MODE_LABEL } from "./shared";

export default function Summary() {
  const summary = useSummary();
  const products = useAdminProducts();

  // Todas as contribuições, mais recentes primeiro, com o presente de cada uma.
  const recent = useMemo(
    () =>
      (products.data ?? [])
        .flatMap((p) => p.contributions.map((c) => ({ ...c, product: p })))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [products.data],
  );
  const bringing = recent.filter((c) => c.mode === "levar");

  if (summary.isPending || products.isPending) return <Loading what="o resumo" />;
  if (summary.isError || products.isError)
    return (
      <LoadError
        onRetry={() => {
          summary.refetch();
          products.refetch();
        }}
      />
    );

  const s = summary.data;
  return (
    <>
      <h1>Resumo</h1>
      <div className="stats">
        <div className="stat">
          <div className="v">
            {s.items.chosen}/{s.items.total}
          </div>
          <div className="l">presentes escolhidos</div>
        </div>
        <div className="stat">
          <div className="v">{s.byMode.levar}</div>
          <div className="l">vão levar no dia</div>
        </div>
        <div className="stat">
          <div className="v">{s.byMode.pix + s.byMode.parte}</div>
          <div className="l">Pix (inteiro ou parte)</div>
        </div>
        <div className="stat">
          <div className="v">{brl(s.pixTotalCents)}</div>
          <div className="l">esperado em Pix</div>
        </div>
      </div>

      <section className="panel">
        <h2>Vales</h2>
        {s.vales.length ? (
          <table className="ctable">
            <thead>
              <tr>
                <th>Vale</th>
                <th className="num">Pessoas</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {s.vales.map((v) => (
                <tr key={v.slug}>
                  <td className="wide">{v.name}</td>
                  <td className="num">{v.count}</td>
                  <td className="num">{brl(v.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="note">Nenhum vale presenteado ainda.</p>
        )}
        {s.partes.length > 0 && (
          <>
            <h2>Partes de presentes</h2>
            <table className="ctable">
              <tbody>
                {s.partes.map((p) => (
                  <tr key={p.slug}>
                    <td className="wide">{p.name}</td>
                    <td className="num">
                      {p.count} {p.count === 1 ? "pessoa" : "pessoas"}
                    </td>
                    <td className="num">{brl(p.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Vão levar no dia ({bringing.length})</h2>
        {bringing.length ? (
          <table className="ctable">
            <tbody>
              {bringing.map((c) => (
                <tr key={c.id}>
                  <td className="wide">{c.guestName}</td>
                  <td className="wide">
                    <Link to={`/admin/presentes/${c.product.id}`}>{c.product.name}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="note">Ninguém marcou que vai levar ainda.</p>
        )}
      </section>

      <section className="panel">
        <h2>Todas as contribuições ({recent.length})</h2>
        {recent.length ? (
          <table className="ctable">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Convidado</th>
                <th>Presente</th>
                <th>Modo</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td>{formatDateTime(c.createdAt)}</td>
                  <td>{c.guestName}</td>
                  <td className="wide">
                    <Link to={`/admin/presentes/${c.product.id}`}>{c.product.name}</Link>
                  </td>
                  <td>{MODE_LABEL[c.mode]}</td>
                  <td className="num">{c.mode === "levar" ? "—" : brl(c.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="note">Nenhuma contribuição ainda.</p>
        )}
      </section>
    </>
  );
}
