import { useState } from "react";
import logo from "../../../logo.svg";
import { managementUrl, supabase } from "../../supabase.js";

export function SetupScreen() {
  return (
    <main className="auth-screen">
      <img className="auth-logo" src={logo} alt="RAVA Studio 3D" />
      <section className="auth-card">
        <span className="auth-eyebrow">Configuração necessária</span>
        <h1>Conecte o Supabase</h1>
        <p>
          Crie o arquivo <code>.env</code> a partir de <code>.env.example</code>,
          informe a URL e a chave pública do projeto e reinicie o servidor.
        </p>
      </section>
    </main>
  );
}

export function LoginScreen({ onMessage }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const { error } = recovery
      ? await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: managementUrl(),
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      onMessage(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha inválidos."
          : error.message,
        "error",
      );
      return;
    }
    if (recovery) {
      onMessage("Enviamos as instruções para redefinir sua senha.");
      setRecovery(false);
    }
  }

  return (
    <main className="auth-screen">
      <img className="auth-logo" src={logo} alt="RAVA Studio 3D" />
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-eyebrow">Área administrativa</span>
        <h1>{recovery ? "Recuperar acesso" : "Bem-vindo"}</h1>
        <p>
          {recovery
            ? "Informe seu e-mail para receber um link seguro."
            : "Entre com a conta cadastrada no Supabase."}
        </p>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        {!recovery && (
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        )}
        <button className="primary" disabled={busy}>
          {busy
            ? "Aguarde…"
            : recovery
              ? "Enviar link"
              : "Entrar no sistema"}
        </button>
        <button
          className="auth-link"
          type="button"
          onClick={() => setRecovery((current) => !current)}
        >
          {recovery ? "Voltar para o login" : "Esqueci minha senha"}
        </button>
      </form>
    </main>
  );
}

export function PasswordScreen({ onDone, onMessage }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password.length < 8)
      return onMessage("A senha deve ter pelo menos 8 caracteres.", "error");
    if (password !== confirmation)
      return onMessage("As senhas não coincidem.", "error");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return onMessage(error.message, "error");
    window.history.replaceState({}, document.title, window.location.pathname);
    onMessage("Senha definida com sucesso.");
    onDone();
  }

  return (
    <main className="auth-screen">
      <img className="auth-logo" src={logo} alt="RAVA Studio 3D" />
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-eyebrow">Acesso seguro</span>
        <h1>Defina sua senha</h1>
        <p>Crie uma senha com pelo menos 8 caracteres para continuar.</p>
        <label>
          Nova senha
          <input
            type="password"
            minLength="8"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirmar senha
          <input
            type="password"
            minLength="8"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar senha"}
        </button>
      </form>
    </main>
  );
}
