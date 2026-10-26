import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import "./styles/fonts.css";
import "./styles/design.css";

// Dashboard em chunk separado: o convidado não baixa o código do admin.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Login = lazy(() => import("./pages/admin/Login"));
const ProductList = lazy(() => import("./pages/admin/ProductList"));
const ProductForm = lazy(() => import("./pages/admin/ProductForm"));
const Summary = lazy(() => import("./pages/admin/Summary"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A primeira chamada pode demorar enquanto a function "acorda": tenta de novo antes de mostrar erro.
      // 401 não adianta repetir (a sessão expirou).
      retry: (count, err) => (err as { status?: number }).status !== 401 && count < 2,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="loading">carregando…</div>}>
          <Routes>
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<ProductList />} />
              <Route path="presentes/novo" element={<ProductForm />} />
              <Route path="presentes/:id" element={<ProductForm />} />
              <Route path="resumo" element={<Summary />} />
              <Route path="*" element={<ProductList />} />
            </Route>
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
