import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Placeholder da Fase 0 — o design é portado na Fase 3.
function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <h1>Casa Nova da Letícia</h1>
      <p>Em construção.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
