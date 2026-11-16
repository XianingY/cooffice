import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";

/** Login and registration forms. Errors come from the AuthProvider, never raw. */
export function AuthForms() {
  const { signIn, signUp, error, clearError } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    clearError();
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password, displayName);
    } catch {
      // Error message is already held in auth state for display.
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel auth-panel" aria-labelledby="auth-title">
      <h2 id="auth-title">{mode === "login" ? "登录以保存项目" : "注册账号"}</h2>
      <p className="hint">不登录也可以本地试用;登录后可跨设备保存项目。</p>
      <form onSubmit={submit} className="auth-form">
        {mode === "register" ? (
          <label>
            显示名称
            <input
              aria-label="显示名称"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              minLength={1}
            />
          </label>
        ) : null}
        <label>
          邮箱
          <input aria-label="邮箱" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          密码
          <input
            aria-label="密码"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {error ? <p role="alert" className="status-error">{error}</p> : null}
        <div className="auth-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); clearError(); }}
          >
            {mode === "login" ? "没有账号?去注册" : "已有账号?去登录"}
          </button>
        </div>
      </form>
    </section>
  );
}
