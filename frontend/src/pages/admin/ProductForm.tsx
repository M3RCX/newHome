import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ROOMS } from "../../content";
import { useAdminProduct, useAdminProducts, useDeleteProduct, useSaveProduct } from "../../hooks/useAdmin";
import { adminErrorMessage, type AdminProduct } from "../../lib/adminApi";
import { parseBrlToCents } from "../../lib/format";
import { shrinkImage } from "../../lib/image";
import type { ProductKind } from "../../lib/types";
import ContributionsPanel from "./ContributionsPanel";
import { LoadError, Loading } from "./shared";

type Draft = {
  kind: ProductKind;
  room: string;
  name: string;
  spec: string;
  price: string;
  purchaseUrl: string;
  slug: string;
};

const centsToInput = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "");

const fromProduct = (p: AdminProduct): Draft => ({
  kind: p.kind,
  room: p.room,
  name: p.name,
  spec: p.spec,
  price: centsToInput(p.priceCents),
  purchaseUrl: p.purchaseUrl ?? "",
  slug: p.slug,
});

const EMPTY: Draft = { kind: "item", room: "Cozinha", name: "", spec: "", price: "", purchaseUrl: "", slug: "" };

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!d.name.trim()) errors.name = "Dê um nome ao presente.";
  if (d.kind === "item" && !d.room.trim()) errors.room = "Escolha o cômodo.";
  if (d.kind === "item" && parseBrlToCents(d.price) <= 0) errors.price = "Informe o valor (ex.: 129,90).";
  if (d.price.trim() && parseBrlToCents(d.price) <= 0 && d.price.trim() !== "0") errors.price = "Valor inválido.";
  if (d.purchaseUrl.trim() && !/^https?:\/\/\S+$/i.test(d.purchaseUrl.trim())) errors.purchaseUrl = "Use um link começando com https://";
  if (d.slug.trim() && !/^[a-z0-9][a-z0-9-]*$/.test(d.slug.trim())) {
    errors.slug = "Só letras minúsculas, números e hífen (ex.: jogo-de-panelas).";
  }
  return errors;
}

export default function ProductFormPage() {
  const { id } = useParams();
  const { data: product, isPending, isError, refetch } = useAdminProduct(id);
  if (!id) return <ProductForm />;
  if (isPending) return <Loading what="o presente" />;
  if (isError) return <LoadError onRetry={refetch} />;
  return <ProductForm key={product.id} product={product} />;
}

function ProductForm({ product }: { product?: AdminProduct }) {
  const navigate = useNavigate();
  const location = useLocation();
  const justCreated = (location.state as { created?: boolean } | null)?.created;
  const { data: all } = useAdminProducts();
  const save = useSaveProduct();
  const remove = useDeleteProduct();

  const [draft, setDraft] = useState<Draft>(product ? fromProduct(product) : EMPTY);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(!!justCreated);

  useEffect(() => {
    if (!image) return;
    return () => URL.revokeObjectURL(image.url);
  }, [image]);

  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };
  const rooms = [...new Set([...ROOMS, ...(all?.map((p) => p.room) ?? [])])].filter((r) => r !== "Cotas");
  const preview = image?.url ?? (removeImage ? null : product?.imageUrl);

  async function pickImage(file: File | undefined) {
    setImageError("");
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      setImage({ blob, url: URL.createObjectURL(blob) });
      setRemoveImage(false);
      setSaved(false);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Não deu pra usar essa imagem.");
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    const form = new FormData();
    form.set("kind", draft.kind);
    form.set("room", draft.kind === "cota" ? "Cotas" : draft.room.trim());
    form.set("name", draft.name.trim());
    form.set("spec", draft.spec.trim());
    form.set("priceCents", String(parseBrlToCents(draft.price)));
    form.set("purchaseUrl", draft.purchaseUrl.trim());
    if (draft.slug.trim()) form.set("slug", draft.slug.trim());
    if (image) form.set("image", image.blob, "foto.jpg");
    else if (removeImage && product) form.set("removeImage", "true");

    save.mutate(
      { id: product?.id, form },
      {
        onSuccess: (p) => {
          setImage(null);
          setRemoveImage(false);
          if (!product) navigate(`/admin/presentes/${p.id}`, { replace: true, state: { created: true } });
          else setSaved(true);
        },
      },
    );
  }

  function doDelete() {
    if (!product) return;
    if (!confirmDelete) return setConfirmDelete(true);
    remove.mutate(product.id, { onSuccess: () => navigate("/admin", { replace: true }) });
  }

  const fieldProps = (key: keyof Draft) => ({
    className: `field${touched && errors[key] ? " invalid" : ""}`,
  });
  const err = (key: keyof Draft) => touched && errors[key] && <span className="err">{errors[key]}</span>;

  return (
    <>
      <p className="note">
        <Link to="/admin">← Presentes</Link>
      </p>
      <h1>{product ? product.name : "Novo presente"}</h1>

      <form className="panel" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="kind">Tipo</label>
            <select id="kind" value={draft.kind} onChange={(e) => set("kind", e.target.value as ProductKind)}>
              <option value="item">Presente (levar ou Pix)</option>
              <option value="cota">Vale (só Pix, repetível)</option>
            </select>
          </div>
          {draft.kind === "item" ? (
            <div {...fieldProps("room")}>
              <label htmlFor="room">Cômodo</label>
              <select id="room" value={draft.room} onChange={(e) => set("room", e.target.value)}>
                {rooms.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              {err("room")}
            </div>
          ) : (
            <div className="field">
              <label>Cômodo</label>
              <span className="hint">Vales aparecem na seção "Vales pra vida nova".</span>
            </div>
          )}

          <div {...fieldProps("name")} style={{ gridColumn: "1/-1" }}>
            <label htmlFor="name">Nome</label>
            <input id="name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={200} />
            {err("name")}
          </div>

          <div className="field full">
            <label htmlFor="spec">
              {draft.kind === "item" ? "Especificação exata (marca, modelo, cor, tamanho, voltagem)" : "Descrição"}
            </label>
            <textarea id="spec" value={draft.spec} onChange={(e) => set("spec", e.target.value)} maxLength={1000} />
          </div>

          <div {...fieldProps("price")}>
            <label htmlFor="price">Valor (R$)</label>
            <input
              id="price"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder={draft.kind === "cota" ? "vazio = valor livre" : "ex.: 129,90"}
            />
            {err("price") || (
              <span className="hint">
                {draft.kind === "cota"
                  ? "Deixe vazio para o convidado escolher o valor."
                  : "A partir de R$ 600 o item aceita ajuda com uma parte."}
              </span>
            )}
          </div>

          <div {...fieldProps("slug")}>
            <label htmlFor="slug">Chave única</label>
            <input
              id="slug"
              value={draft.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
              placeholder={product ? "" : "gerada a partir do nome"}
              maxLength={60}
            />
            {err("slug") || <span className="hint">Identificador do presente; usado na API.</span>}
          </div>

          {draft.kind === "item" && (
            <div {...fieldProps("purchaseUrl")} style={{ gridColumn: "1/-1" }}>
              <label htmlFor="url">Link de onde comprar (opcional)</label>
              <input
                id="url"
                type="url"
                value={draft.purchaseUrl}
                onChange={(e) => set("purchaseUrl", e.target.value)}
                placeholder="https://"
              />
              {err("purchaseUrl")}
            </div>
          )}

          <div className="field full">
            <label htmlFor="image">Foto</label>
            <div className="imgbox">
              <div className="preview">{preview ? <img src={preview} alt="Prévia da foto" /> : "sem foto"}</div>
              <div style={{ display: "grid", gap: 8 }}>
                <input id="image" type="file" accept="image/*" onChange={(e) => pickImage(e.target.files?.[0])} />
                {(image || (product?.imageUrl && !removeImage)) && (
                  <button
                    type="button"
                    className="linkbtn red"
                    onClick={() => {
                      setImage(null);
                      setRemoveImage(!!product?.imageUrl);
                      setSaved(false);
                    }}
                  >
                    Remover foto
                  </button>
                )}
                <span className="hint">A foto é reduzida no navegador antes de enviar.</span>
                {imageError && <span className="err">{imageError}</span>}
              </div>
            </div>
          </div>
        </div>

        {save.isError && (
          <div className="alert" role="alert">
            {adminErrorMessage(save.error)}
          </div>
        )}
        {saved && !save.isPending && <div className="ok-msg">Salvo! Já aparece no site.</div>}

        <div className="row">
          <button type="submit" className="btn main" disabled={save.isPending}>
            {save.isPending ? "Salvando…" : product ? "Salvar alterações" : "Criar presente"}
          </button>
          {product && (
            <button
              type="button"
              className={`btn ${confirmDelete ? "danger" : "ghost"}`}
              onClick={doDelete}
              disabled={remove.isPending}
              onBlur={() => setConfirmDelete(false)}
            >
              {remove.isPending ? "Apagando…" : confirmDelete ? "Toque de novo pra apagar" : "Apagar presente"}
            </button>
          )}
        </div>
        {confirmDelete && product && product.contributions.length > 0 && (
          <p className="note">
            Atenção:{" "}
            {product.contributions.length === 1
              ? "a contribuição deste presente também será apagada."
              : `as ${product.contributions.length} contribuições deste presente também serão apagadas.`}
          </p>
        )}
        {remove.isError && (
          <div className="alert" role="alert">
            {adminErrorMessage(remove.error)}
          </div>
        )}
      </form>

      {product && <ContributionsPanel product={product} />}
    </>
  );
}
