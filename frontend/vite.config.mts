import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// netlify dev: em rotas reescritas (ex.: /admin → /index.html) ele repassa o 304 do Vite como
// 200 sem corpo, e a página abre em branco ao recarregar. Só em dev: sem cache condicional no HTML.
const noConditionalHtml: Plugin = {
  name: "no-conditional-html",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.headers.accept?.includes("text/html")) delete req.headers["if-none-match"];
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), noConditionalHtml],
  server: { port: 5173, strictPort: true },
});
