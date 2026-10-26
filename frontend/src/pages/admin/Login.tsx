import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { adminApi, adminErrorMessage, useSession } from "../../lib/adminApi";
import "../../styles/admin.css";

export default function Login() {
  const session = useSession();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({ mutationFn: () => adminApi.login(email, password) });

  useEffect(() => {
    document.title = "Entrar · Casa Nova";
  }, []);

  if (session) return <Navigate to={from.startsWith("/admin/login") ? "/admin" : from} replace />;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (email && password) login.mutate();
  }

  return (
    <form className="login" onSubmit={submit}>
      <span className="eyebrow">
        <span className="spark" />
        &nbsp; Casa nova
      </span>
      <h1>Modo anfitriã</h1>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {login.isError && (
        <div className="alert" role="alert">
          {adminErrorMessage(login.error)}
        </div>
      )}
      <button type="submit" className="btn main" disabled={login.isPending}>
        {login.isPending ? "Entrando…" : "Entrar"}
      </button>
      <p className="note">
        <Link to="/">Voltar para o site</Link>
      </p>
    </form>
  );
}
