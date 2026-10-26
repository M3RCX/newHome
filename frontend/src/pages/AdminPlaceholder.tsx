import { Link } from "react-router-dom";

// O dashboard chega na Fase 4.
export default function AdminPlaceholder() {
  return (
    <div className="wrap">
      <span className="eyebrow">Modo anfitriã</span>
      <h2 style={{ fontSize: 40, marginTop: 12 }}>Dashboard em construção</h2>
      <p className="note" style={{ marginTop: 16 }}>
        <Link to="/">Voltar para o site</Link>
      </p>
    </div>
  );
}
