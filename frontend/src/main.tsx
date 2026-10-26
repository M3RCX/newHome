import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminPlaceholder from "./pages/AdminPlaceholder";
import Home from "./pages/Home";
import "./styles/fonts.css";
import "./styles/design.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A primeira chamada pode demorar enquanto a function "acorda": tenta de novo antes de mostrar erro.
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminPlaceholder />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
