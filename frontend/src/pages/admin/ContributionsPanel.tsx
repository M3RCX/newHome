import { useState, type FormEvent } from "react";
import { PARTE_MIN_CENTS } from "../../content";
import { useCreateContribution, useDeleteContribution, useUpdateContribution } from "../../hooks/useAdmin";
import { adminErrorMessage, type AdminProduct, type Contribution } from "../../lib/adminApi";
import { brl, parseBrlToCents } from "../../lib/format";
import type { ContributionMode } from "../../lib/types";
import { formatDateTime, MODE_LABEL } from "./shared";

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function modesFor(product: AdminProduct): ContributionMode[] {
  if (product.kind === "cota") return ["pix"];
  return product.priceCents >= PARTE_MIN_CENTS ? ["levar", "pix", "parte"] : ["levar", "pix"];
}

// Linha editável: correção direta (nome, modo, valor) ou remoção.
function Row({ c, product }: { c: Contribution; product: AdminProduct }) {
  const update = useUpdateContribution();
  const remove = useDeleteContribution();
  const [name, setName] = useState(c.guestName);
  const [mode, setMode] = useState(c.mode);
  const [amount, setAmount] = useState(centsToInput(c.amountCents));
  const [confirm, setConfirm] = useState(false);
  const amountCents = parseBrlToCents(amount);
  const dirty = name.trim() !== c.guestName || mode !== c.mode || amountCents !== c.amountCents;
  const modes = [...new Set([...modesFor(product), c.mode])];

  return (
    <tr>
      <td className="wide">
        <input aria-label="Nome" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <select aria-label="Modo" value={mode} onChange={(e) => setMode(e.target.value as ContributionMode)}>
          {modes.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </td>
      <td className="num">
        <input aria-label="Valor (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </td>
      <td className="num">{formatDateTime(c.createdAt)}</td>
      <td className="acts">
        {dirty && (
          <button
            type="button"
            className="linkbtn"
            disabled={update.isPending || !name.trim()}
            onClick={() =>
              update.mutate({ id: c.id, patch: { guestName: name.trim(), mode, amountCents } })
            }
          >
            {update.isPending ? "salvando…" : "salvar"}
          </button>
        )}{" "}
        <button
          type="button"
          className="linkbtn red"
          disabled={remove.isPending}
          onBlur={() => setConfirm(false)}
          onClick={() => (confirm ? remove.mutate(c.id) : setConfirm(true))}
        >
          {remove.isPending ? "removendo…" : confirm ? "confirmar remoção" : "remover"}
        </button>
        {(update.isError || remove.isError) && (
          <div className="err">{adminErrorMessage(update.error ?? remove.error)}</div>
        )}
      </td>
    </tr>
  );
}

// Lançamento manual (ex.: alguém avisou por WhatsApp). Segue as regras da reserva.
function AddForm({ product }: { product: AdminProduct }) {
  const create = useCreateContribution();
  const modes = modesFor(product);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ContributionMode>(modes[0]);
  const [amount, setAmount] = useState("");
  const needsAmount = mode === "parte" || (product.kind === "cota" && product.priceCents === 0);
  const amountCents = parseBrlToCents(amount);
  const blocked = product.kind === "item" && product.status === "escolhido" && mode !== "parte";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || (needsAmount && amountCents <= 0)) return;
    create.mutate(
      {
        productSlug: product.slug,
        guestName: name.trim(),
        mode,
        ...(needsAmount ? { amountCents } : {}),
      },
      {
        onSuccess: () => {
          setName("");
          setAmount("");
        },
      },
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <span className="eyebrow">Lançar manualmente</span>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="c-name">Nome do convidado</label>
          <input id="c-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-mode">Como</label>
          <select id="c-mode" value={mode} onChange={(e) => setMode(e.target.value as ContributionMode)}>
            {modes.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        {needsAmount && (
          <div className="field">
            <label htmlFor="c-amount">Valor (R$)</label>
            <input id="c-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
      </div>
      {blocked && <p className="note">Este item já foi escolhido. Para trocar, edite ou remova a contribuição acima.</p>}
      {create.isError && (
        <div className="alert" role="alert">
          {adminErrorMessage(create.error)}
        </div>
      )}
      <div className="row">
        <button
          type="submit"
          className="btn ghost"
          disabled={create.isPending || blocked || !name.trim() || (needsAmount && amountCents <= 0)}
        >
          {create.isPending ? "Lançando…" : "Lançar contribuição"}
        </button>
      </div>
    </form>
  );
}

export default function ContributionsPanel({ product }: { product: AdminProduct }) {
  const total = product.contributions.reduce((sum, c) => sum + (c.mode === "levar" ? 0 : c.amountCents), 0);

  return (
    <section className="panel" aria-labelledby="h-contribs">
      <div>
        <h2 id="h-contribs">Quem presenteou</h2>
        <p className="note">
          {product.contributions.length
            ? `${product.contributions.length} ${product.contributions.length === 1 ? "contribuição" : "contribuições"}${
                total ? ` · ${brl(total)} em Pix` : ""
              }. Visível só aqui.`
            : "Ninguém ainda."}
        </p>
      </div>
      {product.contributions.length > 0 && (
        <table className="ctable">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Modo</th>
              <th className="num">Valor</th>
              <th className="num">Quando</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {product.contributions.map((c) => (
              <Row key={`${c.id}-${c.guestName}-${c.mode}-${c.amountCents}`} c={c} product={product} />
            ))}
          </tbody>
        </table>
      )}
      <AddForm product={product} />
    </section>
  );
}
