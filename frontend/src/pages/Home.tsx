import { useMemo, useState } from "react";
import Directory from "../components/Directory";
import FloorPlan, { ALL_ROOMS, type Filters } from "../components/FloorPlan";
import GiftCard from "../components/GiftCard";
import Hero from "../components/Hero";
import PickModal from "../components/PickModal";
import Story from "../components/Story";
import ValeCard from "../components/ValeCard";
import { BANDS, site } from "../content";
import { useProducts } from "../hooks/useProducts";
import type { Product } from "../lib/types";

export default function Home() {
  const { data: products, isPending, isError, refetch, isFetching } = useProducts();
  const [filters, setFilters] = useState<Filters>({ room: ALL_ROOMS, band: "todos", onlyFree: false });
  const [picking, setPicking] = useState<Product | null>(null);

  const items = useMemo(() => products?.filter((p) => p.kind === "item") ?? [], [products]);
  const vales = useMemo(() => products?.filter((p) => p.kind === "cota") ?? [], [products]);

  const shown = useMemo(() => {
    const band = BANDS.find((b) => b.id === filters.band) ?? BANDS[0];
    return items.filter(
      (g) =>
        (filters.room === ALL_ROOMS || g.room === filters.room) &&
        (!filters.onlyFree || g.status === "livre") &&
        g.priceCents >= band.minCents &&
        g.priceCents <= band.maxCents,
    );
  }, [items, filters]);

  const listState = isPending ? (
    <div className="loading" role="status">
      abrindo a porta da casa…
    </div>
  ) : isError ? (
    <div className="empty" role="alert">
      não deu pra carregar a lista agora.{" "}
      <button type="button" className="btn ghost" onClick={() => refetch()} disabled={isFetching}>
        {isFetching ? "tentando…" : "tentar de novo"}
      </button>
    </div>
  ) : null;

  return (
    <>
      <div className="wrap">
        <Hero />
        <Directory
          freeItems={products ? items.filter((g) => g.status === "livre").length : null}
          vales={products ? vales.length : null}
        />
        <Story />

        <section id="presentes" aria-labelledby="h-list">
          <div className="sec-head">
            <div>
              <span className="eyebrow">
                <span className="spark" />
                &nbsp; Lista de presentes
              </span>
              <h2 id="h-list">Escolha um cômodo da planta</h2>
              {site.giftNote && <p>{site.giftNote}</p>}
            </div>
          </div>
          <div className="rules">
            <span className="eyebrow">Regras da casa</span>
            <div>
              <b>Presente:</b> opcional
            </div>
            <div>
              <b>Sua presença:</b> obrigatória
            </div>
          </div>
          <ol className="manual">
            <li>
              <b>01</b>Escolha um presente disponível
            </li>
            <li>
              <b>02</b>Decida: levar no dia ou mandar Pix
            </li>
            <li>
              <b>03</b>Avise a gente pelo WhatsApp
            </li>
          </ol>
          <FloorPlan items={items} filters={filters} onChange={setFilters} />
          <div className="grid" aria-live="polite">
            {listState ??
              (shown.length ? (
                shown.map((g) => <GiftCard key={g.slug} gift={g} onPick={setPicking} />)
              ) : (
                <div className="empty">
                  {items.length ? (
                    filters.onlyFree || filters.room !== ALL_ROOMS || filters.band !== "todos" ? (
                      "nada com esses filtros por aqui"
                    ) : (
                      "tudo escolhido por aqui! ♥"
                    )
                  ) : (
                    "a lista está sendo montada"
                  )}
                </div>
              ))}
          </div>
        </section>

        <section className="cotas" id="vales" aria-labelledby="h-cotas">
          <div className="sec-head">
            <div>
              <span className="eyebrow">
                <span className="spark" />
                &nbsp; Só por Pix
              </span>
              <h2 id="h-cotas">Vales pra vida nova</h2>
              <p>Nem tudo que uma casa precisa cabe numa caixa. Destaque um vale e presenteie um momento.</p>
            </div>
          </div>
          <div className="vales">
            {listState ??
              (vales.length ? (
                vales.map((v, i) => <ValeCard key={v.slug} vale={v} number={i + 1} onPick={setPicking} />)
              ) : (
                <div className="empty">nenhum vale ainda</div>
              ))}
          </div>
        </section>

        <footer>
          <span>Com amor, {site.couple}.</span>
          <span className="paws">Lasanha aprova esta lista 🐾</span>
        </footer>
      </div>
      {picking && <PickModal key={picking.slug} gift={picking} onClose={() => setPicking(null)} />}
    </>
  );
}
