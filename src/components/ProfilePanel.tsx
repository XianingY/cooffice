import { useEffect, useState, type FormEvent } from "react";
import type { Api } from "../api/endpoints";
import { ApiError } from "../api/errors";
import { useAuth } from "../auth/AuthProvider";

/** Account settings: display name and password, with readable feedback. */
export function ProfilePanel({ api }: { api: Api }) {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // AuthProvider restores the session asynchronously; sync once it resolves.
  useEffect(() => {
    if (user) setDisplayName(user.displayName);
  }, [user?.id, user?.displayName]);

  if (!user) return null;

  const updateName = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const updated = await api.auth.updateProfile(displayName);
      updateUser(updated);
      setMessage(`显示名称已更新为 ${updated.displayName}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.displayMessage : "更新失败");
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("密码已修改（所有已登录设备的刷新令牌已失效，请按需重新登录）");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.displayMessage : "修改密码失败");
    }
  };

  return (
    <section className="panel" aria-labelledby="profile-title">
      <h2 id="profile-title">账号设置</h2>
      <form onSubmit={updateName} className="profile-form">
        <label>
          显示名称
          <input aria-label="新的显示名称" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        <button type="submit">保存名称</button>
      </form>
      <form onSubmit={changePassword} className="profile-form">
        <label>
          当前密码
          <input aria-label="当前密码" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </label>
        <label>
          新密码
          <input aria-label="新密码" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
        </label>
        <button type="submit">修改密码</button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert" className="status-error">{error}</p> : null}
    </section>
  );
}
