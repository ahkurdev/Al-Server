import { useEffect, useState } from "react";
import type { PhpVersion, VhostEntry } from "../../shared/types";
import { api } from "../api";

export default function SettingsPanel({ notify }: { notify: (m: string) => void }) {
  const [php, setPhp] = useState<PhpVersion[]>([]);
  const [vhosts, setVhosts] = useState<VhostEntry[]>([]);
  const [host, setHost] = useState("myapp.test");
  const [root, setRoot] = useState("C:\\www\\myapp");
  const [server, setServer] = useState<"apache" | "nginx">("apache");

  async function load() {
    setPhp(await api.phpList());
    setVhosts(await api.vhostsList());
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <section className="panel">
        <h2>PHP versions</h2>
        {php.length === 0 && <p className="muted">Taruh versi di resources/binaries/php/&lt;version&gt;/ — contoh php/8.3/, php/8.2/</p>}
        <div className="row">
          {php.map((p) => (
            <button key={p.version} className={p.active ? "btn-on" : ""} onClick={async () => { const r = await api.phpSetActive(p.version); notify(r.message ?? "done"); load(); }}>
              PHP {p.version}{p.active ? " (active)" : ""}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Virtual hosts</h2>
        <div className="row">
          <input value={host} onChange={(e) => setHost(e.target.value)} aria-label="host" />
          <input value={root} onChange={(e) => setRoot(e.target.value)} aria-label="root" />
          <select value={server} onChange={(e) => setServer(e.target.value as "apache" | "nginx")}>
            <option value="apache">apache</option>
            <option value="nginx">nginx</option>
          </select>
          <button onClick={async () => { const r = await api.vhostsAdd({ host, root, server, port: 80 }); notify(r.message ?? "done"); load(); }}>Add</button>
        </div>
        <ul>
          {vhosts.map((v) => (
            <li key={v.host}>{v.host} → {v.root} ({v.server}:{v.port}) <button onClick={async () => { const r = await api.vhostsRemove(v.host); notify(r.message ?? "done"); load(); }}>remove</button></li>
          ))}
        </ul>
        <p className="muted">Menulis file hosts sistem butuh run-as-admin di Windows.</p>
      </section>
      <section className="panel">
        <h2>Backup dan update</h2>
        <div className="row">
          <button onClick={async () => { const r = await api.configExport(); notify(r.message ?? "done"); }}>Export config</button>
          <button onClick={async () => { const r = await api.configImport(); notify(r.message ?? "done"); }}>Import config</button>
          <button onClick={async () => { const r = await api.updaterCheck(); notify(r.message ?? "done"); }}>Check update</button>
          <button onClick={async () => { const r = await api.updaterInstall(); notify(r.message ?? "done"); }}>Download + install update</button>
        </div>
      </section>
    </div>
  );
}
