import { useEffect, useMemo, useRef } from "react";
import CopyButton from "../../components/CopyButton";
import { buildBookmarklet } from "../../lib/meliBookmarklet";

// Página de instalação do favorito "Presente do ML".
export default function Bookmarklet() {
  const { code, href } = useMemo(() => buildBookmarklet(window.location.origin), []);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    document.title = "Botão do Mercado Livre · Casa Nova";
    // O React recusa href "javascript:"; para o arrastar-e-soltar funcionar, o endereço vai direto no elemento.
    linkRef.current?.setAttribute("href", href);
  }, [href]);

  return (
    <>
      <h1>Botão do Mercado Livre</h1>
      <p className="sub">
        Um favorito que lê a página do produto no Mercado Livre e abre o formulário já com nome, valor, foto e
        especificações. Funciona com qualquer link, inclusive os que a API do Mercado Livre bloqueia.
      </p>

      <section className="panel">
        <h2>Como usar</h2>
        <ol className="manual" style={{ flexDirection: "column", border: 0, padding: 0, background: "none" }}>
          <li>
            <b>01</b>
            <span>
              Mostre a barra de favoritos do navegador (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>) e{" "}
              <strong>arraste o botão abaixo</strong> para ela.
            </span>
          </li>
          <li>
            <b>02</b>
            <span>Abra a página de um produto no Mercado Livre e clique nesse favorito.</span>
          </li>
          <li>
            <b>03</b>
            <span>Abre uma nova aba com o formulário preenchido. Confira tudo e salve.</span>
          </li>
        </ol>
        <div className="row">
          {/* href definido no efeito acima */}
          <a ref={linkRef} className="btn brass" draggable="true" onClick={(e) => e.preventDefault()}>
            ➕ Presente do ML
          </a>
        </div>
        <p className="note">
          Este botão abre o formulário em <strong>{window.location.origin}</strong>. Para usar no site publicado, abra esta
          página lá e arraste o botão de novo.
        </p>
      </section>

      <section className="panel">
        <h2>Se o favorito não fizer nada</h2>
        <p className="note">
          Alguns sites bloqueiam favoritos desse tipo. Nesse caso, na página do produto, aperte <kbd>F12</kbd>, abra a aba{" "}
          <strong>Console</strong>, cole o código abaixo e dê Enter (o Chrome pode pedir para você digitar{" "}
          <code>allow pasting</code> antes).
        </p>
        <div className="code" id="bookmarklet-code" style={{ maxHeight: 120 }}>
          {code}
        </div>
        <div className="row">
          <CopyButton text={code} targetId="bookmarklet-code" label="Copiar código" />
        </div>
      </section>
    </>
  );
}
