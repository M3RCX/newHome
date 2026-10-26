import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { logout, useSession } from "../../lib/adminApi";
import "../../styles/admin.css";

// Moldura do dashboard: exige sessão e mostra a navegação.
export default function AdminLayout() {
  const session = useSession();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = "Anfitriã · Casa Nova";
  }, []);

  if (!session) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  function signOut() {
    logout();
    queryClient.removeQueries({ queryKey: ["admin"] });
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <span className="brand">Modo anfitriã</span>
        <nav className="admin-nav" aria-label="Dashboard">
          <NavLink to="/admin" end>
            Presentes
          </NavLink>
          <NavLink to="/admin/presentes/novo">+ Novo</NavLink>
          <NavLink to="/admin/resumo">Resumo</NavLink>
          <a href="/" target="_blank" rel="noopener noreferrer">
            Ver site ↗
          </a>
          <button type="button" onClick={signOut} title={session.email}>
            Sair
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
