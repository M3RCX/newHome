import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { PARTE_MIN_CENTS, pix, whatsapp } from "../content";
import { useContribute } from "../hooks/useProducts";
import { ApiError, errorMessage } from "../lib/api";
import { brl, parseBrlToCents } from "../lib/format";
import { pixCode } from "../lib/pix";
import type { ContributionMode, Product } from "../lib/types";
import CopyButton from "./CopyButton";
import Modal from "./Modal";

const KEY_SVG = (
  <svg viewBox="0 0 84 84" aria-hidden="true">
    <circle cx="26" cy="42" r="16" fill="none" stroke="currentColor" strokeWidth="6" />
    <path d="M42 42h34M64 42v12M72 42v8" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

function whatsappMessage(gift: Product, name: string, payMode: "levar" | "pix", parte: boolean, amountCents: number) {
  return payMode === "pix"
    ? `Oi! Aqui é ${name.trim()}. Fiz o Pix de ${brl(amountCents)} ${parte ? "como parte do presente" : "para"} "${gift.name}" do chá de casa nova!`
    : `Oi! Aqui é ${name.trim()}. Vou levar "${gift.name}" no chá de casa nova (${gift.spec})`;
}

type Props = { gift: Product; onClose: () => void };

// "Vou presentear": escolhe levar / Pix / parte, mostra o Pix e registra a escolha na API.
export default function PickModal({ gift, onClose }: Props) {
  const isCota = gift.kind === "cota";
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ContributionMode | "">(isCota ? "pix" : "");
  const [agree, setAgree] = useState(false);
  const [free, setFree] = useState("");
  const [qr, setQr] = useState("");
  const contribute = useContribute();

  const parte = mode === "parte";
  const payMode = isCota || parte ? "pix" : mode;
  const freeValue = !(gift.priceCents > 0) || parte;
  const amountCents = freeValue ? parseBrlToCents(free) : gift.priceCents;
  const code = payMode === "pix" && amountCents > 0 ? pixCode(pix, amountCents) : "";
  const ready =
    name.trim().length > 0 && !!payMode && (payMode === "pix" ? amountCents > 0 : agree) && !contribute.isPending;
  const conflict = contribute.error instanceof ApiError && contribute.error.status === 409;

  useEffect(() => {
    if (!code) return setQr("");
    let cancelled = false;
    QRCode.toDataURL(code, { margin: 1, width: 400 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(""));
    return () => {
      cancelled = true;
    };
  }, [code]);

  function confirm() {
    if (!ready || !mode) return;
    contribute.mutate({
      slug: gift.slug,
      input: {
        guestName: name.trim(),
        mode: isCota ? "pix" : mode,
        ...(freeValue && payMode === "pix" ? { amountCents } : {}),
      },
    });
  }

  if (contribute.isSuccess && payMode) {
    const msg = whatsappMessage(gift, name, payMode, parte, amountCents);
    const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}` : "";
    return (
      <Modal label="Presente registrado" onClose={onClose}>
        <div className="done" style={{ color: "var(--brass)" }}>
          {KEY_SVG}
          <div className="big" style={{ color: "var(--ink)" }}>
            Obrigada! Falta só avisar
          </div>
          <p className="note">
            {isCota || payMode === "pix"
              ? "Já anotamos o seu presente na lista. Manda essa mensagem pra gente no WhatsApp pra gente saber que o Pix foi seu."
              : "O presente já aparece como escolhido na lista. Manda essa mensagem pra gente no WhatsApp pra gente saber que foi você."}
          </p>
        </div>
        <div className="code" id="wa-text">
          {msg}
        </div>
        <div className="row">
          {wa && (
            <a className="btn main" href={wa} target="_blank" rel="noopener noreferrer">
              Abrir o WhatsApp
            </a>
          )}
          <CopyButton text={msg} targetId="wa-text" label="Copiar mensagem" />
        </div>
        {!wa && <p className="note">Envie essa mensagem pra Letícia ou pro Gui pelo WhatsApp.</p>}
      </Modal>
    );
  }

  return (
    <Modal label={`Presentear: ${gift.name}`} onClose={onClose}>
      <span className="eyebrow">{isCota ? "Vale" : gift.room}</span>
      <h3>{gift.name}</h3>

      <div className="field">
        <label htmlFor="g-name">Seu nome</label>
        <input
          id="g-name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Como a gente te chama"
          autoComplete="name"
        />
      </div>

      {!isCota && (
        <div className="choice" role="radiogroup" aria-label="Como vai presentear">
          <label>
            <span>
              <input
                type="radio"
                name="mode"
                value="levar"
                checked={mode === "levar"}
                onChange={() => {
                  setMode("levar");
                  setAgree(false);
                }}
              />{" "}
              <b>Vou levar</b>
            </span>
            <small>Compro e levo no dia</small>
          </label>
          <label>
            <span>
              <input type="radio" name="mode" value="pix" checked={mode === "pix"} onChange={() => setMode("pix")} />{" "}
              <b>Vou fazer Pix</b>
            </span>
            <small>Mando {brl(gift.priceCents)}</small>
          </label>
          {gift.priceCents >= PARTE_MIN_CENTS && (
            <label style={{ gridColumn: "1/-1" }}>
              <span>
                <input
                  type="radio"
                  name="mode"
                  value="parte"
                  checked={mode === "parte"}
                  onChange={() => setMode("parte")}
                />{" "}
                <b>Quero ajudar com uma parte</b>
              </span>
              <small>Pix de qualquer valor pra esse presente</small>
            </label>
          )}
        </div>
      )}

      {payMode === "levar" && (
        <>
          <div className="specbox">
            <span className="eyebrow">Tem que ser exatamente este</span>
            <strong>{gift.name}</strong>
            <span>{gift.spec}</span>
            {gift.purchaseUrl ? (
              <a href={gift.purchaseUrl} target="_blank" rel="noopener noreferrer">
                Comprar este na loja ↗
              </a>
            ) : (
              <span className="note">Esse ainda não tem modelo definido: combina com a gente antes de comprar.</span>
            )}
          </div>
          <label className="warn">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Vou levar o item igual
            à descrição: mesma marca, modelo, cor, tamanho e voltagem.
          </label>
        </>
      )}

      {payMode === "pix" && (
        <>
          {freeValue ? (
            <div className="field">
              <label htmlFor="g-free">Valor (R$)</label>
              <input
                id="g-free"
                inputMode="decimal"
                value={free}
                onChange={(e) => setFree(e.target.value)}
                placeholder="Ex.: 100"
              />
            </div>
          ) : (
            <div className="specbox">
              <span className="eyebrow">Valor do Pix</span>
              <strong style={{ font: "400 26px var(--display)" }}>{brl(amountCents)}</strong>
            </div>
          )}
          {pix.key ? (
            <>
              {code && (
                <>
                  {qr && (
                    <div className="qr">
                      <img src={qr} alt={`QR Code do Pix de ${brl(amountCents)}`} />
                    </div>
                  )}
                  <div className="field">
                    <label>Pix copia e cola (já com o valor)</label>
                    <div className="code" id="pix-code">
                      {code}
                    </div>
                  </div>
                </>
              )}
              <div className="field">
                <label>Ou use a chave Pix</label>
                <div className="code" id="pix-key">
                  {pix.key}
                </div>
              </div>
              <div className="row">
                {code && <CopyButton text={code} targetId="pix-code" label="Copiar copia e cola" />}
                <CopyButton text={pix.key} targetId="pix-key" label="Copiar chave" />
              </div>
              {pix.name && <p className="note">O Pix vai aparecer em nome de {pix.name}.</p>}
            </>
          ) : (
            <p className="note">A chave Pix vai aparecer aqui em breve.</p>
          )}
        </>
      )}

      {contribute.isError && (
        <div className="alert" role="alert">
          {errorMessage(contribute.error)}
        </div>
      )}

      {conflict ? (
        <button type="button" className="btn ghost" onClick={onClose}>
          Ver outros presentes
        </button>
      ) : (
        <button type="button" className="btn main" disabled={!ready} onClick={confirm}>
          {contribute.isPending ? "Registrando…" : payMode === "pix" ? "Já fiz o Pix" : "Confirmar que vou levar"}
        </button>
      )}
    </Modal>
  );
}
