import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import DatabasePicker from "./components/DatabasePicker";
import LogViewer from "./components/LogViewer";
import SettingsPanel from "./components/SettingsPanel";
import { useServices } from "./hooks/useServices";
import { api } from "./api";

type Tab = "dashboard" | "logs" | "settings";

export default function App() {
  const { services, loading, notice, refresh, setNotice } = useServices();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    api.themeGet().then(setTheme).catch(() => {});
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  async function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try { await api.themeSet(next); } catch { /* preview mode */ }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Al Server</h1>
          <p className="muted">Local dev server manager — gratis tanpa iklan.</p>
        </div>
        <div className="row">
          <button onClick={() => setTab("dashboard")}>Dashboard</button>
          <button onClick={() => setTab("logs")}>Logs</button>
          <button onClick={() => setTab("settings")}>PHP / Vhost / Backup</button>
          <button onClick={toggleTheme}>{theme === "light" ? "Dark" : "Light"}</button>
        </div>
      </header>
      {notice && <div className="notice" onClick={() => setNotice("")}>{notice}</div>}
      {loading ? <p>Loading services…</p> : (
        <>
          {tab === "dashboard" && (
            <>
              <DatabasePicker services={services} onChange={refresh} notify={setNotice} />
              <Dashboard services={services} onChange={refresh} notify={setNotice} />
            </>
          )}
          {tab === "logs" && <LogViewer service="apache" />}
          {tab === "settings" && <SettingsPanel notify={setNotice} />}
        </>
      )}
    </div>
  );
}
