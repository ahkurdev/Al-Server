import { useState } from "react";
import type { ServiceStatus } from "../../shared/types";
import { api } from "../api";
import PortEditor from "./PortEditor";

export default function ServiceCard({ svc, onChange, notify }: { svc: ServiceStatus; onChange: () => void; notify: (m: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function run(op: "start" | "stop" | "restart") {
    setBusy(true);
    try {
      const res = await api[op](svc.name);
      notify(res.message ?? "done");
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    const res = await api.setEnabled(svc.name, !svc.enabled);
    notify(res.message ?? "done");
    await onChange();
  }

  const stateClass = svc.state === "running" ? "st-running" : svc.state === "error" ? "st-error" : "st-stopped";

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{svc.label} {svc.mock && <span className="badge">mock</span>}</div>
          <div className="card-sub">{svc.kind} · port {svc.port} · {svc.pid ? `pid ${svc.pid}` : "no pid"}</div>
        </div>
        <span className={`state ${stateClass}`}>{svc.state}</span>
      </div>
      {svc.lastError && <div className="error">{svc.lastError}</div>}
      <div className="row">
        <button disabled={busy} onClick={() => run("start")}>Start</button>
        <button disabled={busy} onClick={() => run("stop")}>Stop</button>
        <button disabled={busy} onClick={() => run("restart")}>Restart</button>
        <label className="check"><input type="checkbox" checked={svc.enabled} onChange={toggle} /> enabled</label>
      </div>
      <PortEditor svc={svc} onChange={onChange} notify={notify} />
    </div>
  );
}
