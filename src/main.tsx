import { createRoot } from "react-dom/client";
import App from "./App";
import { api, cloudEnabled, setRefreshHandler } from "./api/factory";
import { tokenStore } from "./auth/tokenStore";
import { AuthProvider } from "./auth/AuthProvider";
import "./styles.css";

// Wire the API client's 401 recovery to the shared auth endpoint. The refresh
// token itself travels as an HttpOnly cookie and is never read by JavaScript.
setRefreshHandler(async () => {
  try {
    const response = await api.auth.refresh();
    tokenStore.set(response.accessToken);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
});

createRoot(document.getElementById("root")!).render(
  <AuthProvider api={api} enabled={cloudEnabled}>
    <App />
  </AuthProvider>,
);
